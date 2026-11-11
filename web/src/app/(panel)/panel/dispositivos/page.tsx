import type { Metadata } from "next";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Fila, ListaFilas } from "@/components/ui/lista-filas";
import { createClient } from "@/lib/supabase/server";
import {
  exigirPermiso,
  FormDispositivo,
  listarDispositivos,
  listarUbicaciones,
} from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Dispositivos · ERP Multitiendas" };

const COLUMNAS = "md:grid-cols-[5rem_1fr_1fr]";

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
            <EstadoVacio>Aún no hay dispositivos registrados.</EstadoVacio>
          ) : (
            <ListaFilas
              etiqueta="Dispositivos"
              columnas={COLUMNAS}
              cabeceras={
                <>
                  <span>Prefijo</span>
                  <span>Nombre</span>
                  <span>Ubicación</span>
                </>
              }
            >
              {dispositivos.data.map((d) => (
                <Fila key={d.id} columnas={`grid-cols-[2.75rem_1fr] ${COLUMNAS}`}>
                  <Etiqueta tono="marca" className="font-mono">
                    {d.prefijo}
                  </Etiqueta>
                  <span className="font-semibold">{d.nombre}</span>
                  <span className="text-muted-foreground col-start-2 text-sm md:col-start-3">
                    {d.ubicacion}
                  </span>
                </Fila>
              ))}
            </ListaFilas>
          )}
          <section className="bg-card shadow-card flex flex-col gap-4 rounded-xl border p-5 md:p-6">
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
