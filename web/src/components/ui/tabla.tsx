import { cn } from "@/lib/utils";

// El envoltorio da el scroll horizontal; la primera y la última celda alinean con el relleno de la tarjeta.
export function Tabla({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "text-muted-foreground border-foreground h-10 border-b-2 px-3 text-[13px] font-semibold first:pl-0 last:pr-0",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("h-11 border-b px-3 first:pl-0 last:pr-0", className)} {...props} />;
}

// Celda numérica: cifras tabulares.
export function TdCifra({ className, ...props }: React.ComponentProps<"td">) {
  return <Td className={cn("cifra text-[13px]", className)} {...props} />;
}
