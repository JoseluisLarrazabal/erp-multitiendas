import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { tiposDeProducto } from "@/modules/catalogo";
import { EncabezadoPagina, FormProducto, listarCategorias } from "@/modules/catalogo/panel";
import { exigirPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Nuevo producto · ERP Multitiendas" };

export default async function PaginaProductoNuevo() {
  const { activo } = await exigirPermiso("editar_productos");
  const categorias = await listarCategorias(await createClient(), activo.negocioId);

  return (
    <>
      <EncabezadoPagina
        titulo="Nuevo producto"
        descripcion="Los precios se cargan después, en la pantalla de precios."
        acciones={
          <Link
            href="/panel/productos"
            className="text-primary inline-flex min-h-10 items-center gap-1 text-sm underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden /> Productos
          </Link>
        }
      />
      {categorias.ok ? (
        <div className="bg-card shadow-card max-w-4xl rounded-xl border p-5 md:p-6">
          <FormProducto
            negocioId={activo.negocioId}
            esFrial={activo.tipo === "frial"}
            tipos={tiposDeProducto(activo.tipo)}
            categorias={categorias.data}
          />
        </div>
      ) : (
        <p role="alert" className="text-destructive text-sm">
          {categorias.error}
        </p>
      )}
    </>
  );
}
