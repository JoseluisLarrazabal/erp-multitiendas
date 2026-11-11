import type { Metadata } from "next";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tabla, Td, TdCifra, Th } from "@/components/ui/tabla";
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
                <span className="cifra text-3xl" data-testid="tc-vigente">
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
              <EstadoVacio>Sin registros todavía.</EstadoVacio>
            ) : (
              <Tabla>
                <caption className="sr-only">Últimos 20 tipos de cambio</caption>
                <thead>
                  <tr>
                    <Th scope="col">Fecha</Th>
                    <Th scope="col" className="text-right">
                      Bs por USD
                    </Th>
                    <Th scope="col">Registró</Th>
                  </tr>
                </thead>
                <tbody>
                  {historial.data.map((t) => (
                    <tr key={t.id}>
                      <Td className="text-[13px] tabular-nums">{formatearFecha(t.vigenteDesde)}</Td>
                      <TdCifra className="text-right">{formatearTipoCambio(t.valor)}</TdCifra>
                      <Td>{t.usuario}</Td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
          </Seccion>
        </div>
      )}
    </>
  );
}
