import Link from "next/link";
import { Boxes, ChartColumn, ShoppingCart, Truck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Bloques } from "./bloques";

export function Acciones({ acciones }: { acciones: Bloques["acciones"] }) {
  // En celular la principal ocupa las dos columnas; desde sm van en fila.
  const clase = (principal = false) =>
    cn(
      buttonVariants({ variant: principal ? "default" : "outline" }),
      principal && "col-span-2 sm:col-span-1",
    );
  if (!Object.values(acciones).some(Boolean)) return null;
  return (
    <div
      role="group"
      aria-label="Acciones frecuentes"
      className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
    >
      {acciones.pos && (
        // Enlace plano: el punto de venta es otra app (precacheada), no una ruta del panel.
        <a href="/pos" className={clase(true)}>
          <ShoppingCart aria-hidden />
          Abrir punto de venta
        </a>
      )}
      {acciones.compra && (
        <Link href="/panel/compras/nueva" className={clase()}>
          <Truck aria-hidden />
          Nueva compra
        </Link>
      )}
      {acciones.entrada && (
        <Link href="/panel/inventario/entrada" className={clase()}>
          <Boxes aria-hidden />
          Entrada de inventario
        </Link>
      )}
      {acciones.reportes && (
        <Link href="/panel/reportes" className={clase()}>
          <ChartColumn aria-hidden />
          Ver reportes
        </Link>
      )}
    </div>
  );
}
