import { cn } from "@/lib/utils";

// Solo disposición: campos en fila que envuelven, etiqueta arriba. Cada pantalla pone el <form> (method, action, role, key).
export function BarraFiltros({ className, ...props }: React.ComponentProps<"form">) {
  return <form className={cn("flex flex-wrap items-end gap-x-4 gap-y-3", className)} {...props} />;
}

// Un campo de la barra: etiqueta + control. En 390 px caben dos por fila; `className` ajusta el ancho (p. ej. "min-w-60 flex-[2] sm:max-w-none").
export function CampoFiltro({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-36 flex-1 flex-col gap-1.5 sm:max-w-48", className)}
      {...props}
    />
  );
}
