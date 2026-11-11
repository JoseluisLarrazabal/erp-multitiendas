import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const etiquetaVariants = cva(
  "inline-flex w-fit items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      tono: {
        neutro: "bg-muted text-foreground",
        marca: "bg-secondary text-secondary-foreground",
        exito: "bg-success-soft text-success",
        aviso: "bg-warning-soft text-warning",
        peligro: "bg-destructive-soft text-destructive",
      },
    },
    defaultVariants: { tono: "neutro" },
  },
);

// Estado corto de una fila o ficha: "Activo", "Sin precio", "Anulada". El texto siempre dice el estado; el tono solo lo refuerza.
export function Etiqueta({
  className,
  tono,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof etiquetaVariants>) {
  return <span className={cn(etiquetaVariants({ tono }), className)} {...props} />;
}
