"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hoyLaPaz, type FichaTexto } from "../orden";

// Sin red no se busca cliente: el nombre y el teléfono se escriben y viajan en la ficha de la orden.
export function ClienteEscrito({
  ficha,
  alCambiar,
  bloqueado,
}: {
  ficha: FichaTexto;
  alCambiar: (f: FichaTexto) => void;
  bloqueado: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="text-muted-foreground text-xs">
        Sin conexión: escribe los datos del cliente.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Label className="flex-col items-stretch gap-0.5 text-xs">
          <span className="text-muted-foreground">Nombre</span>
          <Input
            className="h-10"
            autoComplete="off"
            maxLength={200}
            value={ficha.nombre}
            disabled={bloqueado}
            onChange={(e) => alCambiar({ ...ficha, nombre: e.target.value })}
          />
        </Label>
        <Label className="flex-col items-stretch gap-0.5 text-xs">
          <span className="text-muted-foreground">Teléfono (opcional)</span>
          <Input
            className="h-10"
            type="tel"
            name="telefono"
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            value={ficha.telefono}
            disabled={bloqueado}
            onChange={(e) => alCambiar({ ...ficha, telefono: e.target.value })}
          />
        </Label>
      </div>
    </div>
  );
}

// Ficha de la orden de lavandería: Express cambia la lista de todas las líneas; el resto viaja en p_orden.
export function FichaOrden({
  ficha,
  alCambiar,
  express,
  alCambiarExpress,
  bloqueado,
}: {
  ficha: FichaTexto;
  alCambiar: (f: FichaTexto) => void;
  express: boolean;
  alCambiarExpress: (v: boolean) => void;
  bloqueado: boolean;
}) {
  return (
    <fieldset className="border-border flex flex-col gap-2 rounded-lg border p-2.5">
      <legend className="px-1 text-xs font-semibold">Datos de la orden</legend>
      <Label className="min-h-10 justify-between text-sm">
        <span>Express</span>
        <input
          type="checkbox"
          role="switch"
          className="focus-visible:ring-ring/50 size-5 outline-none focus-visible:ring-3"
          checked={express}
          disabled={bloqueado}
          onChange={(e) => alCambiarExpress(e.target.checked)}
        />
      </Label>
      <div className="grid grid-cols-2 gap-2">
        <Label className="flex-col items-stretch gap-0.5 text-xs">
          <span className="text-muted-foreground">Prendas</span>
          <Input
            className="h-10 text-right tabular-nums"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            autoComplete="off"
            value={ficha.prendas}
            disabled={bloqueado}
            onChange={(e) => alCambiar({ ...ficha, prendas: e.target.value })}
          />
        </Label>
        <Label className="flex-col items-stretch gap-0.5 text-xs">
          <span className="text-muted-foreground">Casillero (opcional)</span>
          <Input
            className="h-10"
            autoComplete="off"
            maxLength={20}
            value={ficha.casillero}
            disabled={bloqueado}
            onChange={(e) => alCambiar({ ...ficha, casillero: e.target.value })}
          />
        </Label>
      </div>
      <Label className="flex-col items-stretch gap-0.5 text-xs">
        <span className="text-muted-foreground">Fecha prometida</span>
        <Input
          type="date"
          className="h-10"
          min={hoyLaPaz()}
          value={ficha.fecha}
          disabled={bloqueado}
          onChange={(e) => alCambiar({ ...ficha, fecha: e.target.value })}
        />
      </Label>
      <Label className="flex-col items-stretch gap-0.5 text-xs">
        <span className="text-muted-foreground">Nota (opcional)</span>
        <Input
          className="h-10"
          autoComplete="off"
          maxLength={500}
          value={ficha.nota}
          disabled={bloqueado}
          onChange={(e) => alCambiar({ ...ficha, nota: e.target.value })}
        />
      </Label>
    </fieldset>
  );
}
