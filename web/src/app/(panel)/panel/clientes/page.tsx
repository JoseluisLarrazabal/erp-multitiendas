import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AVISO_FILTRO_INVALIDO } from "@/lib/filtros";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina, Paginador, Seccion } from "@/modules/catalogo/panel";
import {
  leerFiltrosClientes,
  listarClientes,
  ListaClientes,
  NuevoCliente,
  PAGINA_CLIENTES,
} from "@/modules/clientes/panel";
import { exigirAlgunPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Clientes · ERP Multitiendas" };

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activo, permisos } = await exigirAlgunPermiso(["vender", "editar_productos"]);
  const { filtros, invalido } = leerFiltrosClientes(await searchParams);
  const lista = await listarClientes(
    await createClient(),
    activo.negocioId,
    filtros,
    PAGINA_CLIENTES,
  );
  const hrefDe = (pagina: number) => {
    const p = new URLSearchParams();
    if (filtros.q) p.set("q", filtros.q);
    if (pagina > 1) p.set("pagina", String(pagina));
    const s = p.toString();
    return `/panel/clientes${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion={`Clientes de ${activo.nombre}. No se comparten con los otros negocios.`}
      />
      <div className="flex min-w-0 flex-col gap-6">
        <Seccion titulo="Nuevo cliente">
          <NuevoCliente negocioId={activo.negocioId} />
        </Seccion>
        <form
          key={filtros.q}
          method="get"
          action="/panel/clientes"
          role="search"
          aria-label="Buscar clientes"
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex min-w-60 flex-1 flex-col gap-1.5 sm:max-w-md">
            <Label htmlFor="cli-q">Buscar</Label>
            <Input
              id="cli-q"
              name="q"
              type="search"
              defaultValue={filtros.q}
              placeholder="Nombre o documento"
              autoComplete="off"
              className="h-10"
            />
          </div>
          <Button type="submit" className="h-10">
            <Search aria-hidden /> Buscar
          </Button>
          {(filtros.q || invalido) && (
            <Link
              href="/panel/clientes"
              className="text-primary min-h-10 content-center text-sm underline-offset-4 hover:underline"
            >
              Quitar filtros
            </Link>
          )}
        </form>
        {invalido && (
          <p role="status" className="text-sm font-medium">
            {AVISO_FILTRO_INVALIDO}
          </p>
        )}
        {!lista.ok ? (
          <p role="alert" className="text-destructive text-sm">
            {lista.error}
          </p>
        ) : lista.data.filas.length === 0 ? (
          <p className="text-muted-foreground bg-card rounded-xl border p-6 text-sm">
            {filtros.q ? "Ningún cliente coincide con la búsqueda." : "Aún no hay clientes."}
          </p>
        ) : (
          <>
            <ListaClientes
              negocioId={activo.negocioId}
              clientes={lista.data.filas}
              puedeEditar={permisos.includes("editar_productos")}
            />
            <Paginador
              pagina={lista.data.pagina}
              porPagina={PAGINA_CLIENTES}
              total={lista.data.total}
              unidad="clientes"
              hrefDe={hrefDe}
            />
          </>
        )}
      </div>
    </>
  );
}
