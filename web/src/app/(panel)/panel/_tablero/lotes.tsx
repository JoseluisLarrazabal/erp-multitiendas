import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tabla, Td, TdCifra, Th } from "@/components/ui/tabla";
import { textoDias } from "@/modules/inventario";
import { cn } from "@/lib/utils";
import { ErrorBloque, plural, Tarjeta } from "./comun";
import { DIAS_POR_VENCER, lotesProximos } from "./lecturas";

const FILAS = 5;

export async function Lotes({ negocioId }: { negocioId: string }) {
  const r = await lotesProximos(negocioId);
  const titulo = "Lotes por vencer";
  if (!r.ok)
    return <ErrorBloque titulo={titulo} mensaje={r.error} href="/panel/inventario/vencimientos" />;
  const lotes = r.data.slice(0, FILAS);
  return (
    <Tarjeta
      titulo={titulo}
      enlace={{
        href: "/panel/inventario/vencimientos",
        texto: r.data.length > lotes.length ? `Ver los ${r.data.length}` : "Ver vencimientos",
      }}
    >
      {lotes.length === 0 ? (
        <EstadoVacio>
          Ningún lote vence en los próximos {plural(DIAS_POR_VENCER, "día", "días")}.
        </EstadoVacio>
      ) : (
        <Tabla>
          <caption className="sr-only">Lotes que vencen en {DIAS_POR_VENCER} días o menos</caption>
          <thead>
            <tr>
              <Th scope="col">Producto</Th>
              <Th scope="col">Lote</Th>
              <Th scope="col" className="text-right">
                Vence
              </Th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((l) => (
              <tr key={l.loteId}>
                <Td className="font-semibold">{l.productoNombre}</Td>
                <TdCifra>{l.codigo}</TdCifra>
                <Td className={cn("text-right", l.dias < 0 && "text-destructive font-semibold")}>
                  {textoDias(l.dias)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </Tarjeta>
  );
}
