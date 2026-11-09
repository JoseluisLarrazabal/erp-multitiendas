"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Campo, propsCampo } from "@/components/panel/campo";
import { hoyEnBolivia } from "@/lib/format/fecha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectorCliente, type ClienteElegido } from "@/modules/clientes";
import { useOperacion } from "@/modules/inventario/panel-cliente";
import { crearCreditoInicial } from "../actions";
import { MAX_CUOTAS } from "../domain";
import { saldoInicialSchema } from "../schemas";

// Saldo inicial (RF-CRE-06): un crédito sin venta ni caja, con lo que el cliente aún debe y sus cuotas restantes.
export function FormSaldoInicial({ negocioId }: { negocioId: string }) {
  const { operacionId, pendiente, error, enviar: enviarOperacion } = useOperacion();
  const [cliente, setCliente] = useState<ClienteElegido | null>(null);
  const [capital, setCapital] = useState("");
  const [cuotas, setCuotas] = useState("3");
  const [primera, setPrimera] = useState(hoyEnBolivia());
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [hecho, setHecho] = useState<string | null>(null);

  function enviar(e: FormEvent) {
    e.preventDefault();
    setHecho(null);
    const datos = {
      operacionId,
      negocioId,
      clienteId: cliente?.id,
      capital,
      cuotas,
      primera,
    };
    const r = saldoInicialSchema.safeParse(datos);
    if (!r.success) {
      const rotos = new Set(r.error.issues.map((i) => String(i.path[0])));
      return setErrores({
        ...(rotos.has("clienteId") && { cliente: "Elige el cliente." }),
        ...(rotos.has("capital") && {
          capital: "Escribe un monto mayor a 0, con hasta 2 decimales.",
        }),
        ...(rotos.has("cuotas") && { cuotas: `Un entero de 1 a ${MAX_CUOTAS}.` }),
        ...(rotos.has("primera") && { primera: "Elige la fecha de la primera cuota." }),
      });
    }
    setErrores({});
    const nombre = cliente?.nombre ?? "";
    enviarOperacion(
      (op) => crearCreditoInicial({ ...datos, operacionId: op }),
      () => {
        setHecho(`Saldo inicial de ${nombre} cargado.`);
        setCliente(null);
        setCapital("");
      },
    );
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-label="Saldo inicial"
      data-operacion={operacionId}
      className="grid gap-4 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <SelectorCliente negocioId={negocioId} obligatorio valor={cliente} alCambiar={setCliente} />
        <p role="alert" className="text-destructive text-xs empty:hidden">
          {errores.cliente}
        </p>
      </div>
      <Campo id="si-capital" etiqueta="Saldo que debe (Bs)" error={errores.capital}>
        <Input
          id="si-capital"
          inputMode="decimal"
          autoComplete="off"
          className="h-10"
          value={capital}
          onChange={(e) => setCapital(e.target.value)}
          {...propsCampo("si-capital", errores.capital ? { "si-capital": errores.capital } : {})}
        />
      </Campo>
      <Campo id="si-cuotas" etiqueta="Cuotas restantes" error={errores.cuotas}>
        <Input
          id="si-cuotas"
          inputMode="numeric"
          autoComplete="off"
          className="h-10"
          value={cuotas}
          onChange={(e) => setCuotas(e.target.value)}
          {...propsCampo("si-cuotas", errores.cuotas ? { "si-cuotas": errores.cuotas } : {})}
        />
      </Campo>
      <Campo
        id="si-primera"
        etiqueta="Primera cuota vence"
        ayuda="Sin interés: el monto cargado es lo que se debe. Las demás vencen el mismo día de los meses siguientes."
        error={errores.primera}
      >
        <Input
          id="si-primera"
          type="date"
          className="h-10"
          value={primera}
          onChange={(e) => setPrimera(e.target.value)}
          {...propsCampo(
            "si-primera",
            errores.primera ? { "si-primera": errores.primera } : {},
            true,
          )}
        />
      </Campo>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <p role="alert" className="text-destructive text-sm empty:hidden">
          {error}
        </p>
        <p role="status" className="text-sm font-medium empty:hidden">
          {hecho}
        </p>
        <div>
          <Button type="submit" disabled={pendiente} className="h-10">
            {pendiente && <Loader2 className="animate-spin" aria-hidden />}
            Cargar saldo inicial
          </Button>
        </div>
      </div>
    </form>
  );
}
