import type { Metadata } from "next";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina, Seccion } from "@/modules/catalogo/panel";
import { listarProveedores, ListaProveedores, NuevoProveedor } from "@/modules/compras/panel";
import { exigirPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Proveedores · ERP Multitiendas" };

export default async function PaginaProveedores() {
  const { activo, permisos } = await exigirPermiso("gestionar_compras");
  const lista = await listarProveedores(await createClient(), activo.negocioId);

  return (
    <>
      <EncabezadoPagina
        titulo="Proveedores"
        descripcion={`Proveedores de ${activo.nombre}, con lo que se les debe. Los pagos a proveedor no pasan por la caja del POS.`}
      />
      <div className="flex min-w-0 flex-col gap-6">
        <Seccion titulo="Nuevo proveedor">
          <NuevoProveedor negocioId={activo.negocioId} />
        </Seccion>
        {!lista.ok ? (
          <p role="alert" className="text-destructive text-sm">
            {lista.error}
          </p>
        ) : lista.data.length === 0 ? (
          <EstadoVacio>Aún no hay proveedores.</EstadoVacio>
        ) : (
          <ListaProveedores
            negocioId={activo.negocioId}
            proveedores={lista.data}
            puedeAnular={permisos.includes("anular")}
          />
        )}
      </div>
    </>
  );
}
