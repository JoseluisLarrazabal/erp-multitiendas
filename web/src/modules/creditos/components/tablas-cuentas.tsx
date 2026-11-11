import Link from "next/link";
import { formatearBs } from "@/lib/format/moneda";
import type { Cuenta, SaldoCliente } from "../domain";
import { formatearDia } from "@/lib/format/fecha";
import { ETIQUETA_ORIGEN } from "../domain";

const tarjeta = "bg-card divide-y rounded-xl border shadow-card";

// Saldo por cliente (RF-CRE-05). `creditos` trae los créditos de cada cliente para enlazar su detalle.
export function TablaSaldos({
  saldos,
  creditos,
}: {
  saldos: readonly SaldoCliente[];
  creditos: readonly Cuenta[];
}) {
  return (
    <ul aria-label="Saldo por cliente" className={tarjeta}>
      {saldos.map((s) => (
        <li key={s.clienteId} className="flex flex-col gap-2 px-4 py-3">
          <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1">
            <span className="min-w-0 truncate font-medium">
              {s.nombre}
              {s.documento && <span className="text-muted-foreground"> · {s.documento}</span>}
            </span>
            <span className="text-sm font-semibold tabular-nums">{formatearBs(s.saldo)}</span>
            <span className="text-muted-foreground text-xs">
              {s.creditos} {s.creditos === 1 ? "crédito" : "créditos"}
              {s.cuotasVencidas > 0 &&
                ` · ${s.cuotasVencidas} ${s.cuotasVencidas === 1 ? "cuota vencida" : "cuotas vencidas"} (${formatearBs(s.montoVencido)}), ${s.diasAtraso} ${s.diasAtraso === 1 ? "día" : "días"} de atraso`}
            </span>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {creditos
              .filter((c) => c.clienteId === s.clienteId)
              .map((c) => (
                <li key={c.creditoId}>
                  <Link
                    href={`/panel/creditos/${c.creditoId}`}
                    className="text-primary underline underline-offset-4"
                    aria-label={`Detalle del crédito de ${s.nombre} (${ETIQUETA_ORIGEN[c.origen]}${c.ventaNumero ? ` ${c.ventaNumero}` : ""})`}
                  >
                    {c.ventaNumero ?? ETIQUETA_ORIGEN[c.origen]} · {formatearBs(c.saldo)}
                  </Link>
                </li>
              ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

// Créditos con alguna cuota impaga pasada su fecha, con los días de atraso.
export function TablaVencidas({ cuentas }: { cuentas: readonly Cuenta[] }) {
  return (
    <ul aria-label="Cuotas vencidas" className={tarjeta}>
      {cuentas.map((c) => (
        <li
          key={c.creditoId}
          className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 px-4 py-3"
        >
          <Link
            href={`/panel/creditos/${c.creditoId}`}
            className="min-w-0 truncate font-medium underline-offset-4 hover:underline"
          >
            {c.clienteNombre}
            <span className="text-muted-foreground font-normal">
              {" "}
              · {c.ventaNumero ?? ETIQUETA_ORIGEN[c.origen]}
            </span>
          </Link>
          <span className="text-destructive text-sm font-semibold tabular-nums">
            {c.diasAtraso} {c.diasAtraso === 1 ? "día" : "días"} de atraso
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {c.cuotasVencidas} {c.cuotasVencidas === 1 ? "cuota vencida" : "cuotas vencidas"} ·
            vencido {formatearBs(c.montoVencido)} · saldo {formatearBs(c.saldo)}
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {c.proximaVence ? `Impaga más vieja: ${formatearDia(c.proximaVence)}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
