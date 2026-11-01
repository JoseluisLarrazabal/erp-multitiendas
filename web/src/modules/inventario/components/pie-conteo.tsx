import { Button } from "@/components/ui/button";

// Botón para pasar a la revisión, con el aviso de error y el mensaje de éxito del conteo anterior.
export function PieConteo({
  contados,
  pendiente,
  aviso,
  exito,
  alRevisar,
}: {
  contados: number;
  pendiente: boolean;
  aviso: string | null;
  exito: string | null;
  alRevisar: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button id="cont-revisar" className="h-10" onClick={alRevisar} disabled={pendiente}>
          Revisar diferencias ({contados})
        </Button>
      </div>
      <p role="alert" className="text-destructive text-sm empty:hidden">
        {aviso}
      </p>
      <p id="cont-exito" tabIndex={-1} role="status" className="text-sm font-medium outline-none">
        {exito}
      </p>
    </div>
  );
}
