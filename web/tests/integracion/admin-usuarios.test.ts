import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

// Cuentas del seed (supabase/seed.sql). Ninguna clave de servicio: todo entra con login real.
const CLAVE = "Prueba-ERP-2026";
const TIENDA = "a0000000-0000-0000-0000-000000000001";
const LAVANDERIA = "a0000000-0000-0000-0000-000000000002";
const MULTI = "c0000000-0000-0000-0000-000000000007";
const DUENO = "c0000000-0000-0000-0000-000000000001";

const URL_API = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const corrida = Date.now().toString(36);
let contador = 0;
const correoNuevo = () => `it-${corrida}-${++contador}@erp.test`;

const cliente = () => createClient(URL_API, ANON, { auth: { persistSession: false } });

async function entrar(correo: string, clave = CLAVE) {
  const c = cliente();
  const { data, error } = await c.auth.signInWithPassword({ email: correo, password: clave });
  return { c, jwt: data.session?.access_token ?? "", error };
}

type Respuesta = {
  status: number;
  cuerpo: { ok: boolean; data?: { usuario_id: string }; error?: string };
};
async function invocar(jwt: string | null, cuerpo: unknown, metodo = "POST"): Promise<Respuesta> {
  const r = await fetch(`${URL_API}/functions/v1/admin-usuarios`, {
    method: metodo,
    headers: {
      apikey: ANON,
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: metodo === "POST" ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: r.status, cuerpo: (await r.json().catch(() => ({}))) as Respuesta["cuerpo"] };
}

const crear = (jwt: string, extra: Record<string, unknown> = {}) => {
  const correo = correoNuevo();
  return {
    correo,
    peticion: invocar(jwt, {
      accion: "crear",
      negocio_id: TIENDA,
      rol: "vendedor",
      correo,
      nombre: "Persona de prueba",
      clave: "Clave-prueba-1",
      ...extra,
    }),
  };
};

let dueno = "";
let clienteDueno = cliente();
let encargadoTienda = "";
let encargadoLav = "";

beforeAll(async () => {
  const sesionDueno = await entrar("dueno@erp.test");
  dueno = sesionDueno.jwt;
  clienteDueno = sesionDueno.c;
  encargadoTienda = (await entrar("encargado.tienda@erp.test")).jwt;
  encargadoLav = (await entrar("encargado.lavanderia@erp.test")).jwt;
  expect([dueno, encargadoTienda, encargadoLav].every(Boolean)).toBe(true);
});

describe("sesión y método", () => {
  it("sin JWT o con la clave anon responde 401", async () => {
    expect((await invocar(null, {})).status).toBe(401);
    const anon = await invocar(ANON, {});
    expect(anon.status).toBe(401);
    expect(anon.cuerpo.error).toBe("ERP_SIN_SESION");
  });
  it("un método distinto de POST responde 405", async () => {
    const r = await invocar(dueno, null, "GET");
    expect(r.status).toBe(405);
  });
});

describe("crear", () => {
  it("camino feliz: la cuenta entra y ve su negocio con su rol", async () => {
    const { correo, peticion } = crear(dueno);
    const r = await peticion;
    expect(r.cuerpo.ok).toBe(true);
    const { c, error } = await entrar(correo, "Clave-prueba-1");
    expect(error).toBeNull();
    const { data } = await c.from("usuario_negocio").select("negocio_id, rol");
    expect(data).toEqual([{ negocio_id: TIENDA, rol: "vendedor" }]);
  });

  it("sin permiso (encargado de tienda): rechazado y la cuenta no existe", async () => {
    const { correo, peticion } = crear(encargadoTienda);
    const r = await peticion;
    expect(r.status).toBe(403);
    expect(r.cuerpo.error).toBe("ERP_SIN_PERMISO");
    expect((await entrar(correo, "Clave-prueba-1")).error).not.toBeNull();
  });

  it("negocio ajeno: el encargado de lavandería no crea en la tienda", async () => {
    const { correo, peticion } = crear(encargadoLav);
    expect((await peticion).cuerpo.error).toBe("ERP_SIN_PERMISO");
    expect((await entrar(correo, "Clave-prueba-1")).error).not.toBeNull();
  });

  it("datos inválidos: correo, rol, negocio y clave floja", async () => {
    for (const [extra, codigo] of [
      [{ correo: "no-es-correo" }, "ERP_DATOS_INVALIDOS"],
      [{ rol: "superadmin" }, "ERP_DATOS_INVALIDOS"],
      [{ negocio_id: "x" }, "ERP_DATOS_INVALIDOS"],
      [{ nombre: "  " }, "ERP_DATOS_INVALIDOS"],
      [{ clave: "corta1" }, "ERP_CLAVE_DEBIL"],
      [{ clave: "sololetrasaqui" }, "ERP_CLAVE_DEBIL"],
      [{ clave: "1234567890" }, "ERP_CLAVE_DEBIL"],
    ] as const) {
      const r = await crear(dueno, extra).peticion;
      expect(r.status, JSON.stringify(extra)).toBe(400);
      expect(r.cuerpo.error, JSON.stringify(extra)).toBe(codigo);
    }
  });

  it("correo existente: ERP_CORREO_EXISTE", async () => {
    const r = await crear(dueno, { correo: "dueno@erp.test" }).peticion;
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("ERP_CORREO_EXISTE");
  });

  it("encargado de lavandería no crea un dueño: rechazado y la cuenta no queda", async () => {
    const { correo, peticion } = crear(encargadoLav, { negocio_id: LAVANDERIA, rol: "dueno" });
    const r = await peticion;
    expect(r.cuerpo.error).toBe("ERP_DUENO_PROTEGIDO");
    expect((await entrar(correo, "Clave-prueba-1")).error).not.toBeNull();
  });
});

describe("solo el dueño gestiona a los encargados", () => {
  it("un encargado no crea un encargado: 403 y la cuenta no existe", async () => {
    const { correo, peticion } = crear(encargadoLav, { negocio_id: LAVANDERIA, rol: "encargado" });
    const r = await peticion;
    expect(r.status).toBe(403);
    expect(r.cuerpo.error).toBe("ERP_DUENO_PROTEGIDO");
    expect((await entrar(correo, "Clave-prueba-1")).error).not.toBeNull();
  });

  it("un encargado no desactiva ni restablece a otro encargado; el dueño sí", async () => {
    const { correo, peticion } = crear(dueno, { negocio_id: LAVANDERIA, rol: "encargado" });
    const id = (await peticion).cuerpo.data?.usuario_id ?? "";
    expect(id).not.toBe("");
    const baja = await invocar(encargadoLav, { accion: "desactivar", usuario_id: id });
    expect(baja.status).toBe(403);
    const clave = await invocar(encargadoLav, {
      accion: "restablecer_clave",
      usuario_id: id,
      clave: "Clave-nueva-9",
    });
    expect(clave.status).toBe(403);
    expect((await entrar(correo, "Clave-prueba-1")).error).toBeNull();

    expect((await invocar(dueno, { accion: "desactivar", usuario_id: id })).cuerpo.ok).toBe(true);
    expect((await entrar(correo, "Clave-prueba-1")).error).not.toBeNull();
    expect((await invocar(dueno, { accion: "reactivar", usuario_id: id })).cuerpo.ok).toBe(true);
    const r = await invocar(dueno, {
      accion: "restablecer_clave",
      usuario_id: id,
      clave: "Clave-nueva-9",
    });
    expect(r.status).toBe(200);
    expect((await entrar(correo, "Clave-nueva-9")).error).toBeNull();
  });
});

describe("desactivar y reactivar", () => {
  let objetivo = { correo: "", id: "" };
  beforeAll(async () => {
    const { correo, peticion } = crear(dueno);
    objetivo = { correo, id: (await peticion).cuerpo.data?.usuario_id ?? "" };
    expect(objetivo.id).not.toBe("");
  });

  it("sin permiso y negocio ajeno: rechazado, la cuenta sigue entrando", async () => {
    for (const jwt of [encargadoTienda, encargadoLav]) {
      const r = await invocar(jwt, { accion: "desactivar", usuario_id: objetivo.id });
      expect(r.status).toBe(403);
      expect(r.cuerpo.error).toBe("ERP_SIN_PERMISO");
    }
    expect((await entrar(objetivo.correo, "Clave-prueba-1")).error).toBeNull();
  });

  it("datos inválidos", async () => {
    for (const cuerpo of [
      { accion: "desactivar", usuario_id: "x" },
      { accion: "desactivar" },
      { accion: "borrar", usuario_id: objetivo.id },
    ]) {
      const r = await invocar(dueno, cuerpo);
      expect(r.status).toBe(400);
      expect(r.cuerpo.error).toBe("ERP_DATOS_INVALIDOS");
    }
  });

  it("regla 3: sin `usuarios` en todos los negocios de la cuenta no se desactiva; nadie a sí mismo", async () => {
    const multi = await invocar(encargadoLav, { accion: "desactivar", usuario_id: MULTI });
    expect(multi.cuerpo.error).toBe("ERP_SIN_PERMISO");
    const yo = await invocar(dueno, {
      accion: "desactivar",
      usuario_id: "c0000000-0000-0000-0000-000000000001",
    });
    expect(yo.cuerpo.error).toBe("ERP_SIN_PERMISO");
  });

  it("desactivada no entra, su JWT vivo no ve negocios, y reactivada entra", async () => {
    const { c } = await entrar(objetivo.correo, "Clave-prueba-1");
    const ban = await invocar(dueno, { accion: "desactivar", usuario_id: objetivo.id });
    expect(ban.cuerpo.ok).toBe(true);

    expect((await entrar(objetivo.correo, "Clave-prueba-1")).error).not.toBeNull();
    const { data } = await c.from("negocios").select("id");
    expect(data).toEqual([]);

    const alta = await invocar(dueno, { accion: "reactivar", usuario_id: objetivo.id });
    expect(alta.cuerpo.ok).toBe(true);
    expect((await entrar(objetivo.correo, "Clave-prueba-1")).error).toBeNull();

    // Ambos cambios de estado quedan en auditoría, con el dueño como autor.
    const { data: filas } = await clienteDueno
      .from("auditoria")
      .select("accion, usuario_id")
      .eq("tabla", "perfiles")
      .eq("registro_id", objetivo.id)
      .order("id");
    expect(filas).toEqual([
      { accion: "desactivar", usuario_id: DUENO },
      { accion: "reactivar", usuario_id: DUENO },
    ]);
  });
});

describe("restablecer_clave", () => {
  const NUEVA = "Clave-nueva-2";
  let objetivo = { correo: "", id: "" };
  const restablecer = (jwt: string, usuario_id: string, clave = NUEVA) =>
    invocar(jwt, { accion: "restablecer_clave", usuario_id, clave });
  beforeAll(async () => {
    const { correo, peticion } = crear(dueno);
    objetivo = { correo, id: (await peticion).cuerpo.data?.usuario_id ?? "" };
    expect(objetivo.id).not.toBe("");
  });

  it("sin permiso y negocio ajeno: rechazado, la clave vieja sigue sirviendo", async () => {
    for (const jwt of [encargadoTienda, encargadoLav]) {
      const r = await restablecer(jwt, objetivo.id);
      expect(r.status).toBe(403);
      expect(r.cuerpo.error).toBe("ERP_SIN_PERMISO");
    }
    expect((await entrar(objetivo.correo, "Clave-prueba-1")).error).toBeNull();
    expect((await entrar(objetivo.correo, NUEVA)).error).not.toBeNull();
  });

  it("un encargado no restablece a un dueño ni nadie a sí mismo; la clave del dueño no cambia", async () => {
    const sobreDueno = await restablecer(encargadoLav, DUENO);
    expect(sobreDueno.status).toBe(403);
    expect(sobreDueno.cuerpo.error).toBe("ERP_SIN_PERMISO");
    const sobreSi = await restablecer(dueno, DUENO);
    expect(sobreSi.status).toBe(403);
    expect(sobreSi.cuerpo.error).toBe("ERP_SIN_PERMISO");
    expect((await entrar("dueno@erp.test")).error).toBeNull();
    expect((await entrar("dueno@erp.test", NUEVA)).error).not.toBeNull();
  });

  it("entre pares: el encargado no restablece a otro encargado, sí a roles inferiores", async () => {
    const cuenta = async (rol: string) => {
      const { correo, peticion } = crear(dueno, { negocio_id: LAVANDERIA, rol });
      return { correo, id: (await peticion).cuerpo.data?.usuario_id ?? "" };
    };
    const par = await cuenta("encargado");
    expect(par.id).not.toBe("");
    const sobrePar = await restablecer(encargadoLav, par.id);
    expect(sobrePar.status).toBe(403);
    expect(sobrePar.cuerpo.error).toBe("ERP_SIN_PERMISO");
    expect((await entrar(par.correo, "Clave-prueba-1")).error).toBeNull();
    expect((await entrar(par.correo, NUEVA)).error).not.toBeNull();
    for (const rol of ["vendedor", "empleado"]) {
      const inferior = await cuenta(rol);
      expect(inferior.id).not.toBe("");
      expect((await restablecer(encargadoLav, inferior.id)).status, rol).toBe(200);
      expect((await entrar(inferior.correo, NUEVA)).error, rol).toBeNull();
    }
    expect((await restablecer(dueno, par.id)).status).toBe(200);
  });

  it("clave débil o ausente: 400 y no cambia nada", async () => {
    for (const clave of ["corta1", "sololetrasaqui", "1234567890"]) {
      const r = await restablecer(dueno, objetivo.id, clave);
      expect(r.status, clave).toBe(400);
      expect(r.cuerpo.error, clave).toBe("ERP_CLAVE_DEBIL");
    }
    const sinClave = await invocar(dueno, { accion: "restablecer_clave", usuario_id: objetivo.id });
    expect(sinClave.status).toBe(400);
    expect((await entrar(objetivo.correo, "Clave-prueba-1")).error).toBeNull();
  });

  it("ciclo completo: la clave vieja deja de entrar, la nueva entra y queda auditado sin la clave", async () => {
    const r = await restablecer(dueno, objetivo.id);
    expect(r.status).toBe(200);
    expect(r.cuerpo).toEqual({ ok: true, data: { usuario_id: objetivo.id } });
    expect((await entrar(objetivo.correo, "Clave-prueba-1")).error).not.toBeNull();
    expect((await entrar(objetivo.correo, NUEVA)).error).toBeNull();

    const { data: filas } = await clienteDueno
      .from("auditoria")
      .select("accion, usuario_id, antes, despues")
      .eq("tabla", "perfiles")
      .eq("registro_id", objetivo.id)
      .eq("accion", "restablecer_clave");
    expect(filas).toEqual([
      { accion: "restablecer_clave", usuario_id: DUENO, antes: null, despues: null },
    ]);
  });
});
