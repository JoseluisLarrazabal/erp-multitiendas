import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tiposDeProducto } from "@/modules/catalogo";
import {
  EncabezadoPagina,
  EnlaceVolver,
  EstadoProducto,
  FormProducto,
  listarCategorias,
  obtenerProducto,
  urlsDeFotos,
} from "@/modules/catalogo/panel";
import { exigirPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Producto · ERP Multitiendas" };

export default async function PaginaProducto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { activo } = await exigirPermiso("editar_productos");
  // Un id que no es uuid haría fallar la consulta: es "no encontrado", no un error del servidor.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [producto, categorias] = await Promise.all([
    obtenerProducto(supabase, activo.negocioId, id),
    listarCategorias(supabase, activo.negocioId),
  ]);
  if (producto.ok && !producto.data) notFound();
  const error = !producto.ok ? producto.error : !categorias.ok ? categorias.error : null;
  const fotoUrl =
    producto.ok && producto.data?.fotoPath
      ? ((await urlsDeFotos(supabase, [producto.data.fotoPath])).get(producto.data.fotoPath) ??
        null)
      : null;

  return (
    <>
      <EncabezadoPagina
        titulo={producto.ok && producto.data ? producto.data.nombre : "Producto"}
        descripcion={
          producto.ok && producto.data && !producto.data.activo
            ? "Producto inactivo: no se ofrece en la venta."
            : undefined
        }
        acciones={
          <>
            <EnlaceVolver href="/panel/productos">Productos</EnlaceVolver>
            {producto.ok && producto.data && (
              <EstadoProducto
                productoId={producto.data.id}
                nombre={producto.data.nombre}
                activo={producto.data.activo}
              />
            )}
          </>
        }
      />
      {error || !producto.ok || !producto.data || !categorias.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : (
        <div className="bg-card shadow-card max-w-4xl rounded-xl border p-5 md:p-6">
          <FormProducto
            // Remonta al cambiar de producto o al guardar: los campos son no controlados.
            key={`${producto.data.id}-${producto.data.fotoPath}`}
            negocioId={activo.negocioId}
            esFrial={activo.tipo === "frial"}
            tipos={tiposDeProducto(activo.tipo)}
            categorias={categorias.data}
            producto={producto.data}
            fotoUrl={fotoUrl}
          />
        </div>
      )}
    </>
  );
}
