import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Tags } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { createClient } from "@/lib/supabase/server";
import {
  filtrosSchema,
  hrefConFiltros,
  listaPrincipal,
  PAGINA_PRODUCTOS,
  type Filtros,
} from "@/modules/catalogo";
import {
  EncabezadoPagina,
  FiltrosBusqueda,
  ListaProductos,
  listarCategorias,
  listarMarcas,
  listarProductos,
  Paginador,
  urlsDeFotos,
} from "@/modules/catalogo/panel";
import { exigirAlgunPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Productos · ERP Multitiendas" };

export default async function PaginaProductos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activo, permisos } = await exigirAlgunPermiso(["editar_productos", "ver_costos"]);
  const filtros: Filtros = filtrosSchema.parse(await searchParams);
  const puedeEditar = permisos.includes("editar_productos");
  const supabase = await createClient();
  const [lista, categorias, marcas] = await Promise.all([
    listarProductos(supabase, activo.negocioId, filtros, PAGINA_PRODUCTOS),
    listarCategorias(supabase, activo.negocioId),
    listarMarcas(supabase, activo.negocioId),
  ]);
  const error = !lista.ok
    ? lista.error
    : !categorias.ok
      ? categorias.error
      : !marcas.ok
        ? marcas.error
        : null;
  const fotos = lista.ok
    ? await urlsDeFotos(
        supabase,
        lista.data.filas.map((p) => p.fotoPath),
      )
    : new Map();
  const hayFiltros = hrefConFiltros("/", filtros, { pagina: 1 }) !== "/";

  return (
    <>
      <EncabezadoPagina
        titulo="Productos"
        descripcion={`Catálogo de ${activo.nombre}. Escribe o escanea un código de barras para encontrar un producto.`}
        acciones={
          puedeEditar && (
            <>
              <Link
                href="/panel/productos/categorias"
                className={buttonVariants({ variant: "outline" })}
              >
                <Tags aria-hidden /> Categorías
              </Link>
              <Link href="/panel/productos/nuevo" className={buttonVariants()}>
                <Plus aria-hidden /> Nuevo producto
              </Link>
            </>
          )
        }
      />
      <div className="flex flex-col gap-5">
        <FiltrosBusqueda
          ruta="/panel/productos"
          filtros={filtros}
          categorias={categorias.ok ? categorias.data : undefined}
          marcas={marcas.ok ? marcas.data : undefined}
          conInactivos
          enfocarBusqueda
        />
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {lista.ok && lista.data.filas.length === 0 && (
          <EstadoVacio>
            {hayFiltros
              ? "Ningún producto coincide con la búsqueda o los filtros."
              : "Aún no hay productos en este negocio."}
            {!hayFiltros && puedeEditar && (
              <>
                {" "}
                <Link
                  href="/panel/productos/nuevo"
                  className="text-primary underline underline-offset-4"
                >
                  Crea el primero.
                </Link>
              </>
            )}
          </EstadoVacio>
        )}
        {lista.ok && lista.data.filas.length > 0 && (
          <ListaProductos
            productos={lista.data.filas}
            fotos={Object.fromEntries(fotos)}
            puedeEditar={puedeEditar}
            listaPrincipal={listaPrincipal(activo.tipo)}
          />
        )}
        {lista.ok && (
          <Paginador
            pagina={lista.data.pagina}
            porPagina={PAGINA_PRODUCTOS}
            total={lista.data.total}
            hrefDe={(pagina) => hrefConFiltros("/panel/productos", filtros, { pagina })}
          />
        )}
      </div>
    </>
  );
}
