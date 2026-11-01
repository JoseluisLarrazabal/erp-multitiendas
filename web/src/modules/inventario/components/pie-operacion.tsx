import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Botón de envío con su aviso de error (alert) y de éxito (status), igual en todas las operaciones.
export function PieOperacion({
  etiqueta,
  pendiente,
  error,
  exito,
}: {
  etiqueta: string;
  pendiente: boolean;
  error: string | null;
  exito: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button type="submit" disabled={pendiente} className="h-10">
          {pendiente && <Loader2 className="animate-spin" aria-hidden />}
          {etiqueta}
        </Button>
      </div>
      <p role="alert" className="text-destructive text-sm empty:hidden">
        {error}
      </p>
      <p role="status" className="text-sm font-medium">
        {exito && !error ? exito : ""}
      </p>
    </div>
  );
}
