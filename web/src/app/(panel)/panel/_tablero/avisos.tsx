import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatearBs } from "@/lib/format/moneda";
import { createClient } from "@/lib/supabase/server";
import { listarCajaPorRevisar } from "@/modules/caja/panel";
import { textoDias } from "@/modules/inventario";
import {
  DIAS_SIN_RECOGER,
  hrefOrdenes,
  listarReconciliacion,
  PAGINA_RECONCILIACION,
  textoPorRevisar,
} from "@/modules/ventas/panel";
import type { Bloques } from "./bloques";
import { idDeTitulo, plural } from "./comun";
import { masSi } from "./texto";
import { DIAS_POR_VENCER, lotesProximos, ordenesSinRecoger } from "./lecturas";

type Aviso = {
  clave: string;
  titulo: string;
  detalle: string;
  // "y 2 más": va aparte para que no se parta en dos líneas.
  mas?: string;
  href: string;
  accion: string;
  testid?: string;
};
type Falla = { clave: string; que: string; href: string };

const yMas = (n: number) => (n > 1 ? `y ${n - 1} más` : undefined);
const TITULO = "Por atender";

// Lo que espera una decisión de alguien. Una lectura que falla no se calla: queda como fila "No se pudo comprobar".
async function leerAvisos(
  negocioId: string,
  b: Bloques,
): Promise<{ avisos: Aviso[]; fallas: Falla[] }> {
  const supabase = await createClient();
  const [ventas, caja, lotes, ordenes] = await Promise.all([
    b.porRevisar ? listarReconciliacion(supabase, negocioId, null, PAGINA_RECONCILIACION) : null,
    b.porRevisar ? listarCajaPorRevisar(supabase, negocioId) : null,
    b.lotes ? lotesProximos(negocioId) : null,
    b.ordenes ? ordenesSinRecoger(negocioId) : null,
  ]);
  const avisos: Aviso[] = [];
  const fallas: Falla[] = [];
  if (ventas?.ok === false)
    fallas.push({ clave: "ventas", que: "las ventas por revisar", href: "/panel/reconciliacion" });
  if (caja?.ok === false)
    fallas.push({ clave: "caja", que: "los movimientos de caja", href: "/panel/reconciliacion" });
  if (lotes?.ok === false)
    fallas.push({
      clave: "lotes",
      que: "los lotes por vencer",
      href: "/panel/inventario/vencimientos",
    });
  if (ordenes?.ok === false)
    fallas.push({
      clave: "ordenes",
      que: "las órdenes sin recoger",
      href: hrefOrdenes({ estado: "sin_recoger" }),
    });
  const pendientes = ventas?.ok ? ventas.data.filas.filter((f) => !f.revisada) : [];
  if (ventas?.ok && pendientes.length > 0)
    avisos.push({
      clave: "ventas",
      titulo: textoPorRevisar(pendientes.length, ventas.data.siguiente !== null)!,
      detalle: `Venta ${pendientes[0]!.numero} · ${formatearBs(pendientes[0]!.total)}`,
      mas: yMas(pendientes.length),
      href: "/panel/reconciliacion",
      accion: "Reconciliar",
      testid: "aviso-por-revisar",
    });
  if (caja?.ok && caja.data.filas.length > 0) {
    const f = caja.data.filas[0]!;
    avisos.push({
      clave: "caja",
      titulo: textoPorRevisar(0, false, caja.data.filas.length, caja.data.hayMas)!,
      detalle: `${f.detalle} · ${formatearBs(f.monto)}${f.usuario ? ` · ${f.usuario}` : ""}`,
      mas: yMas(caja.data.filas.length),
      href: "/panel/reconciliacion",
      accion: "Revisar",
    });
  }
  if (lotes?.ok && lotes.data.length > 0)
    avisos.push({
      clave: "lotes",
      titulo: `${plural(lotes.data.length, "lote vence", "lotes vencen")} en ${DIAS_POR_VENCER} días o menos`,
      detalle: `${lotes.data[0]!.productoNombre} · ${textoDias(lotes.data[0]!.dias)}`,
      mas: yMas(lotes.data.length),
      href: "/panel/inventario/vencimientos",
      accion: "Ver lotes",
    });
  if (ordenes?.ok && ordenes.data.filas.length > 0) {
    const mas = masSi(ordenes.data.siguiente !== null);
    avisos.push({
      clave: "ordenes",
      titulo: `${ordenes.data.filas.length}${mas} ${ordenes.data.filas.length === 1 && !mas ? "orden" : "órdenes"} sin recoger`,
      detalle: `Listas hace más de ${plural(DIAS_SIN_RECOGER, "día", "días")}`,
      href: hrefOrdenes({ estado: "sin_recoger" }),
      accion: "Ver órdenes",
    });
  }
  return { avisos, fallas };
}

const FILA =
  "flex min-h-16 items-center gap-3 rounded-xl px-4 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring";

// Siempre se dibuja (misma columna con o sin avisos); ámbar solo cuando hay algo que atender.
export async function Avisos({ negocioId, bloques }: { negocioId: string; bloques: Bloques }) {
  const { avisos, fallas } = await leerAvisos(negocioId, bloques);
  const idTitulo = idDeTitulo(TITULO);
  const urgente = avisos.length > 0;
  const borde = urgente ? "border-warning-line" : "border-border";
  return (
    <section
      aria-labelledby={idTitulo}
      className={cn(
        "shadow-card rounded-xl border",
        urgente ? "bg-warning-soft border-warning-line" : "bg-card",
      )}
    >
      <h2
        id={idTitulo}
        className={cn(
          "flex items-center justify-between gap-2 px-4 pt-4 pb-1 text-[15px] font-semibold",
          urgente && "text-warning",
        )}
      >
        <span className="flex items-center gap-2">
          {urgente && <TriangleAlert className="size-4" aria-hidden />}
          {TITULO}
        </span>
        {urgente && <span className="cifra text-sm">{avisos.length}</span>}
      </h2>
      {!urgente && fallas.length === 0 && (
        <p className="text-muted-foreground px-4 pt-1 pb-4 text-sm">Nada por atender</p>
      )}
      <ul>
        {avisos.map((a) => (
          <li key={a.clave} className={cn("border-t first:border-t-0", borde)}>
            <Link
              href={a.href}
              data-testid={a.testid}
              className={cn(FILA, "hover:bg-warning-line/25")}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-snug font-semibold">{a.titulo}</span>
                <span className="block text-[13px] leading-snug">
                  {a.detalle}
                  {a.mas && (
                    <>
                      {" "}
                      <span className="whitespace-nowrap">{a.mas}</span>
                    </>
                  )}
                </span>
              </span>
              <span className={buttonVariants({ variant: "outline", size: "sm" })}>{a.accion}</span>
            </Link>
          </li>
        ))}
        {fallas.map((f) => (
          <li key={f.clave} className={cn("border-t first:border-t-0", borde)}>
            <Link href={f.href} className={cn(FILA, "hover:bg-muted")}>
              <span className="text-muted-foreground min-w-0 flex-1 text-[13px] leading-snug">
                No se pudo comprobar {f.que}
              </span>
              <span className={buttonVariants({ variant: "outline", size: "sm" })}>Abrir</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
