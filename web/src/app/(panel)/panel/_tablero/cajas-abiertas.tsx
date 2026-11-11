import { createClient } from "@/lib/supabase/server";
import { formatearBs } from "@/lib/format/moneda";
import { diaEnBolivia, formatearHora, hoyEnBolivia } from "@/lib/format/fecha";
import { Tabla, Td, TdCifra, Th } from "@/components/ui/tabla";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { leerReporte } from "@/modules/reportes/panel";
import { sesionesAbiertas } from "@/modules/ventas/panel";
import { ErrorBloque, Tarjeta } from "./comun";
import { restarDias } from "./serie";

const TITULO = "Cajas abiertas";

export async function CajasAbiertas({ negocioId }: { negocioId: string }) {
  const supabase = await createClient();
  const abiertas = await sesionesAbiertas(supabase, negocioId);
  if (!abiertas.ok)
    return <ErrorBloque titulo={TITULO} mensaje={abiertas.error} href="/panel/cajas" />;
  const enlace = { href: "/panel/cajas", texto: "Ver cajas" };
  if (abiertas.data.length === 0)
    return (
      <Tarjeta titulo={TITULO} enlace={enlace}>
        <EstadoVacio>No hay cajas abiertas ahora.</EstadoVacio>
      </Tarjeta>
    );
  // reporte_caja agrupa por el día de apertura: se pide desde la caja abierta más antigua, y la RPC rechaza
  // rangos de más de un año (una caja olvidada no debe tumbar el bloque).
  const hoy = hoyEnBolivia();
  const desde = [restarDias(hoy, 365), ...abiertas.data.map((s) => diaEnBolivia(s.abiertaEn))]
    .sort()
    .at(-1)!;
  const r = await leerReporte(supabase, negocioId, {
    r: "caja",
    desde,
    hasta: hoy,
    agrupar: "dia",
    dias: 30,
    filtro: "todo",
  });
  if (!r.ok) return <ErrorBloque titulo={TITULO} mensaje={r.error} href="/panel/cajas" />;
  const filas = r.data.tipo === "caja" ? r.data.filas.filter((f) => f.cerrada_en === null) : [];
  if (filas.length === 0)
    return (
      <Tarjeta titulo={TITULO} enlace={enlace}>
        <EstadoVacio>No hay cajas abiertas ahora.</EstadoVacio>
      </Tarjeta>
    );
  return (
    <Tarjeta titulo={TITULO} enlace={enlace}>
      <Tabla>
        <caption className="sr-only">Cajas abiertas ahora</caption>
        <thead>
          <tr>
            <Th scope="col">Equipo</Th>
            <Th scope="col">Cajero</Th>
            <Th scope="col">Desde</Th>
            <Th scope="col" className="text-right">
              Cobrado en ventas
            </Th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.sesion_id}>
              <Td className="font-semibold">{f.equipo}</Td>
              <Td>{f.cajero}</Td>
              <TdCifra>{formatearHora(f.abierta_en)}</TdCifra>
              <TdCifra className="text-right">
                {formatearBs(f.ventas_efectivo + f.ventas_qr)}
              </TdCifra>
            </tr>
          ))}
        </tbody>
      </Tabla>
    </Tarjeta>
  );
}
