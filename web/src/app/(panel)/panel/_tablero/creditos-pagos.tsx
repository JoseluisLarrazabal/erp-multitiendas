import { createClient } from "@/lib/supabase/server";
import { formatearBs } from "@/lib/format/moneda";
import { cargarCuentas } from "@/modules/creditos/panel";
import { resumenDeudaProveedores } from "@/modules/compras/panel";
import { cargarReservasActivas } from "@/modules/ventas/panel";
import { Tarjeta, plural } from "./comun";
import { masSi } from "./texto";
import type { Bloques } from "./bloques";

const LIMITE_CUOTAS = 200;

// `vacio`: la frase apagada cuando no hay nada que mostrar (no se pinta un "Bs 0,00" en negrita).
type Fila = { titulo: string; detalle: string; valor: string; urgente?: boolean; vacio?: string };
type Lectura = Fila | string | null;

const sumar = (xs: number[]) => xs.reduce((t, x) => t + x, 0);

export async function CreditosPagos({
  negocioId,
  bloques,
}: {
  negocioId: string;
  bloques: Bloques;
}) {
  const supabase = await createClient();
  const [cuotas, reservas, porPagar] = await Promise.all([
    bloques.cuotas
      ? cargarCuentas(supabase, negocioId, { soloVencidas: true, limite: LIMITE_CUOTAS }).then(
          (r): Lectura => {
            if (!r.ok) return r.error;
            const { cuentas, total } = r.data;
            const mas = masSi(total > cuentas.length);
            const clientes = new Set(cuentas.map((c) => c.clienteId)).size;
            return {
              titulo: "Cuotas vencidas",
              detalle: `${plural(total, "crédito", "créditos")} · ${plural(clientes, "cliente", "clientes")}${mas}`,
              valor: `${formatearBs(sumar(cuentas.map((c) => c.montoVencido)))}${mas}`,
              urgente: total > 0,
              vacio: total === 0 ? "Sin cuotas vencidas" : undefined,
            };
          },
        )
      : null,
    bloques.reservas
      ? cargarReservasActivas(supabase, negocioId).then((r): Lectura => {
          if (!r.ok) return r.error;
          return {
            titulo: "Reservas activas",
            detalle: `Anticipos ${formatearBs(sumar(r.data.map((x) => x.anticipo)))}`,
            valor: String(r.data.length),
            vacio: r.data.length === 0 ? "Sin reservas activas" : undefined,
          };
        })
      : null,
    bloques.porPagar
      ? resumenDeudaProveedores(supabase, negocioId).then((r): Lectura => {
          if (!r.ok) return r.error;
          return {
            titulo: "Por pagar a proveedores",
            detalle: plural(r.data.proveedores, "proveedor con deuda", "proveedores con deuda"),
            valor: formatearBs(r.data.total),
            vacio: r.data.proveedores === 0 ? "Sin deudas con proveedores" : undefined,
          };
        })
      : null,
  ]);
  const lecturas = (
    [
      ["cuotas", cuotas],
      ["reservas", reservas],
      ["por-pagar", porPagar],
    ] as const
  ).flatMap(([clave, l]) => (l === null ? [] : [{ clave, l }]));
  return (
    <Tarjeta
      titulo={bloques.cuotas || bloques.reservas ? "Créditos y pagos" : "Pagos a proveedores"}
      enlace={bloques.cuotas ? { href: "/panel/creditos", texto: "Créditos" } : undefined}
    >
      <ul className="-my-1 flex flex-col">
        {lecturas.map(({ clave, l }) =>
          typeof l === "string" ? (
            <li key={clave} className="border-b py-3 last:border-b-0">
              <p role="alert" className="text-destructive text-sm">
                {l}
              </p>
            </li>
          ) : l.vacio ? (
            <li key={clave} className="text-muted-foreground border-b py-3 text-sm last:border-b-0">
              {l.vacio}
            </li>
          ) : (
            <li
              key={clave}
              className="flex items-baseline justify-between gap-4 border-b py-3 last:border-b-0"
            >
              <div>
                <p className="text-sm font-semibold">{l.titulo}</p>
                <p className="text-muted-foreground text-[13px]">{l.detalle}</p>
              </div>
              <p className={`cifra text-[15px] ${l.urgente ? "text-destructive" : ""}`}>
                {l.valor}
              </p>
            </li>
          ),
        )}
      </ul>
    </Tarjeta>
  );
}
