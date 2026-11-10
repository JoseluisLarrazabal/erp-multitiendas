import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina, Seccion } from "@/modules/catalogo/panel";
import { cargarNegocio, FormDatosNegocio } from "@/modules/ventas/panel";
import { exigirPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Datos del negocio · ERP Multitiendas" };

export default async function PaginaNegocio() {
  const { activo } = await exigirPermiso("usuarios");
  const negocio = await cargarNegocio(await createClient(), activo.negocioId);

  return (
    <>
      <EncabezadoPagina
        titulo="Datos del negocio"
        descripcion={`NIT, dirección y teléfono de ${activo.nombre}, tal como salen en la nota de venta y en la boleta.`}
      />
      {!negocio.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {negocio.error}
        </p>
      ) : (
        <div className="max-w-3xl">
          <Seccion titulo="Datos impresos">
            <FormDatosNegocio
              negocioId={activo.negocioId}
              nit={negocio.data.nit}
              datosNota={negocio.data.datosNota}
            />
          </Seccion>
        </div>
      )}
    </>
  );
}
