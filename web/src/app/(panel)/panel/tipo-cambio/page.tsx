import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatearFecha, formatearTipoCambio } from "@/modules/catalogo";
import {
  EncabezadoPagina,
  FormTipoCambio,
  historialTipoCambio,
  Seccion,
} from "@/modules/catalogo/panel";
import { exigirPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Tipo de cambio · ERP Multitiendas" };

export default async function PaginaTipoCambio() {
  const { activo } = await exigirPermiso("editar_productos");
  const historial = await historialTipoCambio(await createClient(), activo.negocioId);
  const vigente = historial.ok ? historial.data[0] : undefined;

  return (
    <>
      <EncabezadoPagina
        titulo="Tipo de cambio"
        descripcion={`Bolivianos por 1 USD en ${activo.nombre}. Rige el más reciente y convierte los precios en USD a Bs.`}
      />
      {!historial.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {historial.error}
        </p>
      ) : (
        <div className="flex max-w-3xl flex-col gap-6">
          <Seccion titulo="Vigente">
            {vigente ? (
              <p>
                <span
                  className="text-3xl font-bold tracking-tight tabular-nums"
                  data-testid="tc-vigente"
                >
                  Bs {formatearTipoCambio(vigente.valor)}
                </span>
                <span className="text-muted-foreground ml-3 text-sm">
                  por 1 USD, desde el {formatearFecha(vigente.vigenteDesde)}
                </span>
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                Aún no hay tipo de cambio. Sin él, los precios en USD no tienen equivalente en Bs.
              </p>
            )}
          </Seccion>
          <Seccion titulo="Registrar nuevo">
            <FormTipoCambio negocioId={activo.negocioId} vigente={vigente?.valor ?? null} />
          </Seccion>
          <Seccion titulo="Historial">
            {historial.data.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin registros todavía.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Últimos 20 tipos de cambio</caption>
                  <thead>
                    <tr className="text-muted-foreground border-b text-left text-xs font-semibold">
                      <th scope="col" className="py-2 pr-4">
                        Fecha
                      </th>
                      <th scope="col" className="py-2 pr-4 text-right">
                        Bs por USD
                      </th>
                      <th scope="col" className="py-2">
                        Registró
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.data.map((t) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 tabular-nums">{formatearFecha(t.vigenteDesde)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {formatearTipoCambio(t.valor)}
                        </td>
                        <td className="py-2">{t.usuario}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Seccion>
        </div>
      )}
    </>
  );
}
