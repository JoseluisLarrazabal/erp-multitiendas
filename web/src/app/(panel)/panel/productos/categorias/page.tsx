import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  EncabezadoPagina,
  FormCategoria,
  listarCategorias,
  Seccion,
} from "@/modules/catalogo/panel";
import { exigirPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Categorías · ERP Multitiendas" };

export default async function PaginaCategorias() {
  const { activo } = await exigirPermiso("editar_productos");
  const categorias = await listarCategorias(await createClient(), activo.negocioId);

  return (
    <>
      <EncabezadoPagina
        titulo="Categorías"
        descripcion={`Agrupan los productos de ${activo.nombre}. No se pueden borrar, solo renombrar.`}
        acciones={
          <Link
            href="/panel/productos"
            className="text-primary inline-flex min-h-10 items-center gap-1 text-sm underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden /> Productos
          </Link>
        }
      />
      {!categorias.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {categorias.error}
        </p>
      ) : (
        <div className="flex max-w-3xl flex-col gap-6">
          <Seccion titulo="Categoría nueva">
            <FormCategoria negocioId={activo.negocioId} />
          </Seccion>
          {categorias.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aún no hay categorías.</p>
          ) : (
            <ul className="bg-card shadow-card divide-y rounded-xl border" aria-label="Categorías">
              {categorias.data.map((c) => (
                <li key={`${c.id}-${c.nombre}`} className="px-4 py-3">
                  <FormCategoria negocioId={activo.negocioId} categoria={c} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
