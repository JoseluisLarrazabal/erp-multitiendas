import Link from "next/link";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Fila, ListaFilas } from "@/components/ui/lista-filas";
import { formatearBs } from "@/lib/format/moneda";
import type { Cuenta, SaldoCliente } from "../domain";
import { formatearDia } from "@/lib/format/fecha";
import { ETIQUETA_ORIGEN } from "../domain";

const COLUMNAS_SALDOS = "md:grid-cols-[minmax(0,1.2fr)_8rem_minmax(0,1.8fr)]";
const COLUMNAS_VENCIDAS = "md:grid-cols-[minmax(0,1.2fr)_9rem_minmax(0,1.6fr)_minmax(0,1fr)]";

// Saldo por cliente (RF-CRE-05). `creditos` trae los créditos de cada cliente para enlazar su detalle.
export function TablaSaldos({
  saldos,
  creditos,
}: {
  saldos: readonly SaldoCliente[];
  creditos: readonly Cuenta[];
}) {
  return (
    <ListaFilas
      etiqueta="Saldo por cliente"
      columnas={COLUMNAS_SALDOS}
      cabeceras={
        <>
          <span>Cliente</span>
          <span className="text-right">Saldo</span>
          <span>Créditos</span>
        </>
      }
    >
      {saldos.map((s) => (
        <Fila
          key={s.clienteId}
          columnas={`grid-cols-[1fr_auto] ${COLUMNAS_SALDOS}`}
          className="items-start"
        >
          <span className="min-w-0 truncate font-semibold">
            {s.nombre}
            {s.documento && (
              <span className="text-muted-foreground font-normal"> · {s.documento}</span>
            )}
          </span>
          <span className="cifra text-[13px] font-semibold md:text-right">
            {formatearBs(s.saldo)}
          </span>
          <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
            <span className="text-muted-foreground text-[13px]">
              {s.creditos} {s.creditos === 1 ? "crédito" : "créditos"}
              {s.cuotasVencidas > 0 && (
                <span className="text-destructive">
                  {` · ${s.cuotasVencidas} ${s.cuotasVencidas === 1 ? "cuota vencida" : "cuotas vencidas"} (${formatearBs(s.montoVencido)}), ${s.diasAtraso} ${s.diasAtraso === 1 ? "día" : "días"} de atraso`}
                </span>
              )}
            </span>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {creditos
                .filter((c) => c.clienteId === s.clienteId)
                .map((c) => (
                  <li key={c.creditoId}>
                    <Link
                      href={`/panel/creditos/${c.creditoId}`}
                      className="text-primary focus-visible:ring-ring inline-flex min-h-10 items-center rounded underline underline-offset-4 outline-none focus-visible:ring-3 md:min-h-0"
                      aria-label={`Detalle del crédito de ${s.nombre} (${ETIQUETA_ORIGEN[c.origen]}${c.ventaNumero ? ` ${c.ventaNumero}` : ""})`}
                    >
                      {c.ventaNumero ?? ETIQUETA_ORIGEN[c.origen]} · {formatearBs(c.saldo)}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </Fila>
      ))}
    </ListaFilas>
  );
}

// Créditos con alguna cuota impaga pasada su fecha, con los días de atraso.
export function TablaVencidas({ cuentas }: { cuentas: readonly Cuenta[] }) {
  return (
    <ListaFilas
      etiqueta="Cuotas vencidas"
      columnas={COLUMNAS_VENCIDAS}
      cabeceras={
        <>
          <span>Cliente</span>
          <span>Atraso</span>
          <span>Cuotas</span>
          <span>Impaga más vieja</span>
        </>
      }
    >
      {cuentas.map((c) => (
        <Fila key={c.creditoId} columnas={`grid-cols-[1fr_auto] ${COLUMNAS_VENCIDAS}`}>
          <Link
            href={`/panel/creditos/${c.creditoId}`}
            className="focus-visible:ring-ring min-w-0 truncate rounded font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-3"
          >
            {c.clienteNombre}
            <span className="text-muted-foreground font-normal">
              {" "}
              · {c.ventaNumero ?? ETIQUETA_ORIGEN[c.origen]}
            </span>
          </Link>
          <Etiqueta tono="peligro" className="justify-self-end md:justify-self-start">
            {c.diasAtraso} {c.diasAtraso === 1 ? "día" : "días"} de atraso
          </Etiqueta>
          <span className="text-muted-foreground col-span-2 text-[13px] tabular-nums md:col-span-1">
            {c.cuotasVencidas} {c.cuotasVencidas === 1 ? "cuota vencida" : "cuotas vencidas"} ·
            vencido {formatearBs(c.montoVencido)} · saldo {formatearBs(c.saldo)}
          </span>
          <span className="text-muted-foreground col-span-2 text-[13px] tabular-nums md:col-span-1">
            {c.proximaVence ? `Impaga más vieja: ${formatearDia(c.proximaVence)}` : ""}
          </span>
        </Fila>
      ))}
    </ListaFilas>
  );
}
