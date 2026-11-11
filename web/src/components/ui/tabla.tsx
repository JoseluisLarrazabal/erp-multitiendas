import { cn } from "@/lib/utils";

export function Tabla({ className, ...props }: React.ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />;
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "text-muted-foreground border-foreground h-10 border-b-2 px-3 text-xs font-semibold",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("h-11 border-b px-3", className)} {...props} />;
}
