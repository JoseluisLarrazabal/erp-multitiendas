import { Loader2 } from "lucide-react";

export default function Cargando() {
  return (
    <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Cargando…
    </p>
  );
}
