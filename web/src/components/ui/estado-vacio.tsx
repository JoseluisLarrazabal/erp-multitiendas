import { cn } from "@/lib/utils";

export function EstadoVacio({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground bg-surface rounded-lg border border-dashed px-4 py-8 text-center text-sm",
        className,
      )}
      {...props}
    />
  );
}
