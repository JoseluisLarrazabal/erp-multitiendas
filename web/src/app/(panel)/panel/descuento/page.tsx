import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina, Seccion } from "@/modules/catalogo/panel";
import { cargarNegocio, FormTope } from "@/modules/ventas/panel";
import { exigirPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Descuento · ERP Multitiendas" };

export default async function PaginaDescuento() {
  const { activo } = await exigirPermiso("usuarios");
  const negocio = await cargarNegocio(await createClient(), activo.negocioId);

  return (
    <>
      <EncabezadoPagina
        titulo="Tope de descuento"
        descripcion={`Porcentaje máximo de descuento sobre una venta en ${activo.nombre}. Con 0 % nadie descuenta.`}
      />
      {!negocio.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {negocio.error}
        </p>
      ) : (
        <div className="flex max-w-3xl flex-col gap-6">
          <Seccion titulo="Vigente">
            <p>
              <span className="cifra text-3xl" data-testid="tope-vigente">
                {String(negocio.data.topeDescuento).replace(".", ",")} %
              </span>
              <span className="text-muted-foreground ml-3 text-sm">del subtotal de la venta</span>
            </p>
          </Seccion>
          <Seccion titulo="Cambiar">
            <FormTope negocioId={activo.negocioId} vigente={negocio.data.topeDescuento} />
          </Seccion>
        </div>
      )}
    </>
  );
}
