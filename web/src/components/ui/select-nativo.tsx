import * as React from "react";
import { cn } from "@/lib/utils";

// <select> nativo con el aspecto de Input: en móvil abre el selector del sistema, sin dependencias.
function SelectNativo({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive bg-card h-10 w-full min-w-0 rounded-lg border px-3 text-base transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { SelectNativo };
