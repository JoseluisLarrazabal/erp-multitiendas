import { createClient } from "@/lib/supabase/server";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tabla, Td, TdCifra, Th } from "@/components/ui/tabla";
import { hrefStock } from "@/modules/inventario";
import { listarStockBajo } from "@/modules/inventario/panel";
import { ErrorBloque, Tarjeta } from "./comun";

const FILAS = 5;
const CANTIDAD = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 3 });

export async function StockBajo({ negocioId }: { negocioId: string }) {
  const r = await listarStockBajo(await createClient(), negocioId, FILAS);
  if (!r.ok) return <ErrorBloque titulo="Stock bajo" mensaje={r.error} href="/panel/inventario" />;
  const { total, filas } = r.data;
  return (
    <Tarjeta
      titulo="Stock bajo"
      enlace={{
        href: hrefStock({ bajo: true }),
        texto: total > filas.length ? `Ver los ${total}` : "Ver inventario",
      }}
    >
      {filas.length === 0 ? (
        <EstadoVacio>Ningún producto está bajo su mínimo.</EstadoVacio>
      ) : (
        <Tabla>
          <caption className="sr-only">Productos bajo su mínimo, {total} en total</caption>
          <thead>
            <tr>
              <Th scope="col">Producto</Th>
              <Th scope="col" className="text-right">
                Hay
              </Th>
              <Th scope="col" className="text-right">
                Mínimo
              </Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.productoId}>
                <Td className="font-semibold">{f.nombre}</Td>
                <TdCifra className="text-destructive text-right">
                  {CANTIDAD.format(f.cantidad)}
                </TdCifra>
                <TdCifra className="text-right">{CANTIDAD.format(f.minimo)}</TdCifra>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </Tarjeta>
  );
}
