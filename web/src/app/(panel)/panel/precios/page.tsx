import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  FILTROS_VACIOS,
  filtrosSchema,
  hrefConFiltros,
  listasDelNegocio,
  PAGINA_PRECIOS,
  type Filtros,
} from "@/modules/catalogo";
import {
  EncabezadoPagina,
  filasDePrecios,
  FiltrosBusqueda,
  GrillaPrecios,
  listarProductos,
  Paginador,
  tipoCambioVigente,
} from "@/modules/catalogo/panel";
import { exigirPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Precios · ERP Multitiendas" };

export default async function PaginaPrecios({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activo, permisos } = await exigirPermiso("editar_productos");
  // La grilla solo filtra por búsqueda y "sin precio"; los demás parámetros se ignoran.
  const { q, sinPrecio, pagina }: Filtros = filtrosSchema.parse(await searchParams);
  const filtros: Filtros = { ...FILTROS_VACIOS, q, sinPrecio, pagina };
  const verCostos = permisos.includes("ver_costos") && permisos.includes("ajustar_inventario");
  const supabase = await createClient();
  const [lista, tipoCambio] = await Promise.all([
    listarProductos(supabase, activo.negocioId, filtros, PAGINA_PRECIOS),
    tipoCambioVigente(supabase, activo.negocioId),
  ]);
  const filas = lista.ok
    ? await filasDePrecios(supabase, lista.data.filas, activo.negocioId, verCostos)
    : null;
  const error = !lista.ok
    ? lista.error
    : !tipoCambio.ok
      ? tipoCambio.error
      : !filas?.ok
        ? filas?.error
        : null;
  const hayFiltros = filtros.q !== "" || filtros.sinPrecio;
  // La página pedida puede quedar fuera de rango (p. ej. tras guardar precios en la última de "sin precio"):
  // listarProductos devuelve la efectiva y todo lo demás la usa.
  const efectivos: Filtros = { ...filtros, pagina: lista.ok ? lista.data.pagina : filtros.pagina };

  return (
    <>
      <EncabezadoPagina
        titulo="Precios"
        descripcion="Carga los precios de todas las listas de una vez. La moneda de una fila vale para todas sus listas. Guarda solo lo que cambiaste."
      />
      <div className="flex min-w-0 flex-col gap-5">
        <FiltrosBusqueda ruta="/panel/precios" filtros={filtros} />
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {tipoCambio.ok && tipoCambio.data === null && (
          <p className="bg-secondary text-secondary-foreground rounded-lg px-3 py-2 text-sm">
            No hay tipo de cambio registrado: los precios en USD no tendrán equivalente en Bs hasta
            registrarlo.
          </p>
        )}
        {lista.ok && tipoCambio.ok && filas?.ok && filas.data.length === 0 && (
          <p className="text-muted-foreground bg-card rounded-xl border p-6 text-sm">
            {hayFiltros
              ? "Ningún producto coincide con la búsqueda."
              : "Aún no hay productos para ponerles precio."}
          </p>
        )}
        {lista.ok && tipoCambio.ok && filas?.ok && filas.data.length > 0 && (
          <GrillaPrecios
            // Remonta al cambiar de página o de filtro: los borradores son de las filas visibles.
            key={hrefConFiltros("", efectivos)}
            negocioId={activo.negocioId}
            filas={filas.data}
            listas={listasDelNegocio(activo.tipo)}
            tipoCambio={tipoCambio.data}
            verCostos={verCostos}
            enfocarPrimera={filtros.q !== ""}
          />
        )}
        {lista.ok && (
          <Paginador
            pagina={lista.data.pagina}
            porPagina={PAGINA_PRECIOS}
            total={lista.data.total}
            hrefDe={(p) => hrefConFiltros("/panel/precios", efectivos, { pagina: p })}
          />
        )}
      </div>
    </>
  );
}
