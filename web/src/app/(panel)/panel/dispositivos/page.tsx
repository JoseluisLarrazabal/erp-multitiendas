import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  exigirPermiso,
  FormDispositivo,
  listarDispositivos,
  listarUbicaciones,
} from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Dispositivos · ERP Multitiendas" };

export default async function PaginaDispositivos() {
  const { activo } = await exigirPermiso("usuarios");
  const supabase = await createClient();
  const ubicaciones = await listarUbicaciones(supabase, activo.negocioId);
  const dispositivos = ubicaciones.ok
    ? await listarDispositivos(supabase, activo.negocioId, ubicaciones.data)
    : null;
  const error = !ubicaciones.ok
    ? ubicaciones.error
    : !dispositivos?.ok
      ? dispositivos?.error
      : null;

  return (
    <>
      <div className="mb-7">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Dispositivos</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Cajas y equipos de {activo.nombre}. El prefijo identifica los comprobantes de cada uno.
        </p>
      </div>
      {error || !ubicaciones.ok || !dispositivos?.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {dispositivos.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aún no hay dispositivos registrados.</p>
          ) : (
            <ul className="bg-card divide-y rounded-xl border shadow-[0_2px_5px_#34345a0d]">
              {dispositivos.data.map((d) => (
                <li
                  key={d.id}
                  className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 px-4 py-3.5 md:grid-cols-[5rem_1fr_1fr]"
                >
                  <span className="bg-secondary text-secondary-foreground w-fit rounded-md px-2 py-0.5 font-mono text-xs font-semibold">
                    {d.prefijo}
                  </span>
                  <span className="font-semibold">{d.nombre}</span>
                  <span className="text-muted-foreground col-start-2 text-sm md:col-start-3">
                    {d.ubicacion}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <section className="bg-card flex flex-col gap-4 rounded-xl border p-5 shadow-[0_2px_5px_#34345a0d] md:p-6">
            <h2 className="text-[15px] font-semibold tracking-tight">Registrar dispositivo</h2>
            {ubicaciones.data.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {activo.nombre} aún no tiene ubicaciones, y cada dispositivo se registra en una.
                Pide a soporte que cree la primera y vuelve aquí.
              </p>
            ) : (
              <FormDispositivo negocioId={activo.negocioId} ubicaciones={ubicaciones.data} />
            )}
          </section>
        </div>
      )}
    </>
  );
}
