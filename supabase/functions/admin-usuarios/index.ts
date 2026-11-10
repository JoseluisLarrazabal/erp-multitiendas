// Crear y desactivar cuentas exige la API admin de Auth. La llaman solo server actions del panel: sin CORS.
// Dos clientes: el del llamador (JWT) decide permisos por RPC; service_role toca auth.admin, auditar_cuenta y auditar_clave.
// Versiones iguales a web/package.json.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { z } from "npm:zod@4.6.7";

const ROLES = ["dueno", "encargado", "contador", "vendedor", "empleado"] as const;
// Misma política que [auth] de config.toml: 8 o más, con letras y dígitos.
const clave = z
  .string()
  .min(8)
  .max(72)
  .regex(/[A-Za-z]/)
  .regex(/\d/);

const entrada = z.discriminatedUnion("accion", [
  z.object({
    accion: z.literal("crear"),
    negocio_id: z.guid(),
    rol: z.enum(ROLES),
    correo: z.string().trim().toLowerCase().pipe(z.email()),
    nombre: z.string().trim().min(1).max(120),
    clave,
  }),
  z.object({ accion: z.enum(["desactivar", "reactivar"]), usuario_id: z.guid() }),
  z.object({ accion: z.literal("restablecer_clave"), usuario_id: z.guid(), clave }),
]);

const CODIGOS_RPC = new Set([
  "ERP_SIN_PERMISO",
  "ERP_DATOS_INVALIDOS",
  "ERP_DUENO_PROTEGIDO",
  "ERP_AUTOGESTION",
]);
const ESTADO: Record<string, number> = {
  ERP_SIN_SESION: 401,
  ERP_SIN_PERMISO: 403,
  ERP_DUENO_PROTEGIDO: 403,
  ERP_AUTOGESTION: 403,
  ERP_ULTIMO_DUENO: 409,
  ERP_CORREO_EXISTE: 409,
  ERP_DATOS_INVALIDOS: 400,
  ERP_CLAVE_DEBIL: 400,
  ERP_METODO: 405,
};

const responder = (cuerpo: { ok: true; data: unknown } | { ok: false; error: string }) =>
  Response.json(cuerpo, { status: cuerpo.ok ? 200 : (ESTADO[cuerpo.error] ?? 500) });
const falla = (error: string) => responder({ ok: false, error });

// Sin detalles internos: del error de Postgres solo sale un código de la lista.
const codigoDeRpc = (mensaje: string | undefined) => {
  const c = mensaje?.match(/ERP_[A-Z_]+/)?.[0];
  return c && CODIGOS_RPC.has(c) ? c : "ERP_INTERNO";
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return falla("ERP_METODO");

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const servicio = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !servicio) return falla("ERP_INTERNO");
  if (!jwt) return falla("ERP_SIN_SESION");

  const sinSesion = { auth: { persistSession: false, autoRefreshToken: false } };
  const llamador = createClient(url, anon, {
    ...sinSesion,
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: sesion, error: errorSesion } = await llamador.auth.getUser(jwt);
  if (errorSesion || !sesion.user) return falla("ERP_SIN_SESION");

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return falla("ERP_DATOS_INVALIDOS");
  }
  const parsed = entrada.safeParse(cuerpo);
  if (!parsed.success) {
    // Contraseña floja y datos mal formados se distinguen para dar un mensaje útil.
    const flojo = parsed.error.issues.some((i) => i.path[0] === "clave");
    return falla(flojo ? "ERP_CLAVE_DEBIL" : "ERP_DATOS_INVALIDOS");
  }
  const datos = parsed.data;
  const clienteServicio = createClient(url, servicio, sinSesion);
  const admin = clienteServicio.auth.admin;

  try {
    if (datos.accion === "crear") {
      // Antes de crear nada: un rol prohibido nunca deja una cuenta nueva. asignar_usuario sigue imponiendo lo suyo.
      const { data: permitido, error } = await llamador.rpc("puede_asignar_rol", {
        p_negocio_id: datos.negocio_id,
        p_rol: datos.rol,
      });
      if (error) return falla("ERP_INTERNO");
      if (permitido !== true) {
        // Solo en el camino de rechazo se pregunta por qué, para dar el código claro.
        const { data: conPermiso, error: errorPermiso } = await llamador.rpc("tiene_permiso", {
          p_negocio_id: datos.negocio_id,
          p_permiso: "usuarios",
        });
        if (errorPermiso) return falla("ERP_INTERNO");
        if (conPermiso !== true) return falla("ERP_SIN_PERMISO");
        return falla(datos.rol === "dueno" ? "ERP_DUENO_PROTEGIDO" : "ERP_DATOS_INVALIDOS");
      }

      const { data: creada, error: errorCrear } = await admin.createUser({
        email: datos.correo,
        password: datos.clave,
        email_confirm: true,
        user_metadata: { nombre: datos.nombre },
      });
      if (errorCrear || !creada.user) {
        if (errorCrear?.code === "email_exists") return falla("ERP_CORREO_EXISTE");
        if (errorCrear?.code === "weak_password") return falla("ERP_CLAVE_DEBIL");
        return falla("ERP_INTERNO");
      }

      const { error: errorAsignar } = await llamador.rpc("asignar_usuario", {
        p_negocio_id: datos.negocio_id,
        p_usuario_id: creada.user.id,
        p_rol: datos.rol,
      });
      if (errorAsignar) {
        // Fallo real (carrera, red): la cuenta recién creada no debe quedar sin negocio.
        const { error: errorBorrar } = await admin.deleteUser(creada.user.id);
        // Si la limpieza falla queda una cuenta sin negocio: se avisa, no se oculta.
        return falla(errorBorrar ? "ERP_CUENTA_HUERFANA" : codigoDeRpc(errorAsignar.message));
      }
      return responder({ ok: true, data: { usuario_id: creada.user.id } });
    }

    const { data: puede, error } = await llamador.rpc("puede_administrar_cuenta", {
      p_usuario_id: datos.usuario_id,
    });
    if (error) return falla("ERP_INTERNO");
    if (puede !== true) return falla("ERP_SIN_PERMISO");

    if (datos.accion === "restablecer_clave") {
      // La clave no se devuelve ni se registra: ni en la respuesta ni en auditoría.
      const { error: errorClave } = await admin.updateUserById(datos.usuario_id, {
        password: datos.clave,
      });
      if (errorClave) {
        return falla(errorClave.code === "weak_password" ? "ERP_CLAVE_DEBIL" : "ERP_INTERNO");
      }
      // La clave ya cambió: si la auditoría falla se avisa, no se oculta ni se deshace.
      const { error: errorAuditoria } = await clienteServicio.rpc("auditar_clave", {
        p_actor_id: sesion.user.id,
        p_usuario_id: datos.usuario_id,
      });
      if (errorAuditoria) return falla("ERP_AUDITORIA");
      return responder({ ok: true, data: { usuario_id: datos.usuario_id } });
    }

    // Solo desactivar y reactivar llegan aquí; una acción nueva no debe caer en el baneo por descuido.
    if (datos.accion !== "desactivar" && datos.accion !== "reactivar") return falla("ERP_INTERNO");
    const { error: errorBan } = await admin.updateUserById(datos.usuario_id, {
      ban_duration: datos.accion === "desactivar" ? "876000h" : "none",
    });
    // El trigger que sincroniza el baneo lanza ERP_ULTIMO_DUENO si dejaría un negocio sin dueño activo.
    if (errorBan) {
      return falla(errorBan.message?.includes("ERP_ULTIMO_DUENO") ? "ERP_ULTIMO_DUENO" : "ERP_INTERNO");
    }
    // El baneo ya rige: si la auditoría falla se avisa, no se oculta ni se deshace.
    const { error: errorAuditoria } = await clienteServicio.rpc("auditar_cuenta", {
      p_actor_id: sesion.user.id,
      p_usuario_id: datos.usuario_id,
      p_activo: datos.accion === "reactivar",
    });
    if (errorAuditoria) return falla("ERP_AUDITORIA");
    return responder({ ok: true, data: { usuario_id: datos.usuario_id } });
  } catch {
    return falla("ERP_INTERNO");
  }
});
