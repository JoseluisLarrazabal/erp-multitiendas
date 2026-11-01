import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  exigirPermiso,
  FormPersonaExistente,
  FormUsuarioNuevo,
  listarPersonasDeOtrosNegocios,
  listarUsuariosDelNegocio,
  rolesDelTipo,
  rolesOfrecidos,
  UsuariosTabla,
} from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Usuarios · ERP Multitiendas" };

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-4 rounded-xl border p-5 shadow-[0_2px_5px_#34345a0d] md:p-6">
      <h2 className="text-[15px] font-semibold tracking-tight">{titulo}</h2>
      {children}
    </section>
  );
}

export default async function PaginaUsuarios() {
  const { activo, usuario } = await exigirPermiso("usuarios");
  const supabase = await createClient();
  const [filas, rolesTipo] = await Promise.all([
    listarUsuariosDelNegocio(supabase, activo.negocioId, usuario.id),
    rolesDelTipo(supabase, activo.tipo),
  ]);
  const personas = filas.ok
    ? await listarPersonasDeOtrosNegocios(
        supabase,
        activo.negocioId,
        usuario.id,
        filas.data.map((f) => f.usuarioId),
      )
    : null;

  const esDueno = activo.rol === "dueno";
  const roles = rolesTipo.ok ? rolesOfrecidos(rolesTipo.data, esDueno) : [];
  const error = !filas.ok ? filas.error : !rolesTipo.ok ? rolesTipo.error : null;

  return (
    <>
      <div className="mb-7">
        <h1
          id="titulo-pagina"
          tabIndex={-1}
          className="text-[28px] leading-tight font-bold tracking-tight outline-none"
        >
          Usuarios
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Personal de {activo.nombre}. Cada persona tiene una sola cuenta y puede trabajar en varios
          negocios.
        </p>
      </div>
      {error || !filas.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {filas.data.length <= 1 && (
            <p className="text-muted-foreground text-sm">
              Aún no hay otras personas en este negocio. Crea una cuenta o agrega a alguien de tus
              otros negocios.
            </p>
          )}
          <UsuariosTabla
            filas={filas.data}
            negocioId={activo.negocioId}
            negocioNombre={activo.nombre}
            roles={roles}
            llamadorEsDueno={esDueno}
          />
          <Seccion titulo="Cuenta nueva">
            <FormUsuarioNuevo negocioId={activo.negocioId} roles={roles} />
          </Seccion>
          <Seccion titulo="Agregar persona de otro negocio">
            {personas && !personas.ok ? (
              <p role="alert" className="text-destructive text-sm">
                {personas.error}
              </p>
            ) : (
              <FormPersonaExistente
                negocioId={activo.negocioId}
                roles={roles}
                personas={personas?.ok ? personas.data : []}
              />
            )}
          </Seccion>
        </div>
      )}
    </>
  );
}
