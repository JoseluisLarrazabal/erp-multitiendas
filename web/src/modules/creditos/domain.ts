// Aritmética del crédito en centavos enteros. Debe coincidir con plan_cuotas y registrar_venta (20261108160000):
// sistema francés (P-07), la última cuota absorbe la diferencia, vence el mismo día de los meses siguientes.
// El servidor es la verdad: esto solo anticipa el plan en pantalla.

export const MAX_CUOTAS = 36;
export const FRECUENCIA = "mensual";

export type CuotaPlan = { numero: number; capital: number; interes: number; monto: number };

// round() de Postgres sobre positivos: mitad hacia arriba. `pct100`: porcentaje en centésimas (2,5 % -> 250).
const redondear = (n: number, d: number) => Math.floor((n + d / 2) / d);

export const aCentesimas = (pct: number) => Math.round(pct * 100);

// Plan de cuotas de `capital` (centavos) a `interesPct` (% mensual, hasta 2 decimales) en `n` cuotas. [] si no es válido.
export function planCuotas(capital: number, interesPct: number, n: number): CuotaPlan[] {
  if (!Number.isInteger(capital) || capital <= 0 || !Number.isInteger(n) || n < 1 || n > MAX_CUOTAS)
    return [];
  if (!(interesPct >= 0 && interesPct <= 100)) return [];
  const pct100 = aCentesimas(interesPct);
  const i = pct100 / 10_000;
  const cuota = Math.round(pct100 === 0 ? capital / n : (capital * i) / (1 - Math.pow(1 + i, -n)));
  const filas: CuotaPlan[] = [];
  let saldo = capital;
  for (let k = 1; k <= n; k++) {
    const interes = redondear(saldo * pct100, 10_000);
    const cap = k === n ? saldo : Math.min(cuota - interes, saldo);
    if (cap < 0 || cap + interes <= 0) return [];
    filas.push({ numero: k, capital: cap, interes, monto: cap + interes });
    saldo -= cap;
  }
  return filas;
}

// Mínimo de la inicial en centavos: inicial_pct del total, redondeado hacia arriba (igual que registrar_venta).
export const inicialMinima = (total: number, inicialPct: number) =>
  Math.floor((total * aCentesimas(inicialPct) + 9_999) / 10_000);

// `fecha` (AAAA-MM-DD) más `meses`: el mismo día, o el último del mes cuando es más corto (Postgres: fecha + interval).
export function sumarMeses(fecha: string, meses: number): string {
  const [a, m, d] = fecha.split("-").map(Number) as [number, number, number];
  const destino = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(
    Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0),
  ).getUTCDate();
  destino.setUTCDate(Math.min(d, ultimo));
  return destino.toISOString().slice(0, 10);
}

// Vencimiento de la cuota `numero` de un crédito creado `hoy`: siempre sobre la fecha base, nunca encadenado.
export const vencimiento = (hoy: string, numero: number) => sumarMeses(hoy, numero);

export const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

const formatoLaPaz = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const hoyLaPaz = (ahora: Date = new Date()) => formatoLaPaz.format(ahora);

export const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

export type Cuenta = {
  creditoId: string;
  clienteId: string;
  clienteNombre: string;
  clienteDocumento: string | null;
  origen: "venta" | "saldo_inicial";
  ventaNumero: string | null;
  creadoEn: string;
  total: number;
  pagado: number;
  saldo: number;
  cuotasVencidas: number;
  montoVencido: number;
  diasAtraso: number;
  proximaVence: string | null;
  proximoMonto: number;
};

export type SaldoCliente = {
  clienteId: string;
  nombre: string;
  documento: string | null;
  creditos: number;
  saldo: number;
  cuotasVencidas: number;
  montoVencido: number;
  diasAtraso: number;
};

const centavos = (bs: number) => Math.round(bs * 100);

// Saldo por cliente (RF-CRE-05): suma de sus créditos activos. Primero los más atrasados, luego el mayor saldo.
export function agruparPorCliente(cuentas: readonly Cuenta[]): SaldoCliente[] {
  const porCliente = new Map<string, SaldoCliente & { c: number; v: number }>();
  for (const c of cuentas) {
    const g = porCliente.get(c.clienteId) ?? {
      clienteId: c.clienteId,
      nombre: c.clienteNombre,
      documento: c.clienteDocumento,
      creditos: 0,
      saldo: 0,
      cuotasVencidas: 0,
      montoVencido: 0,
      diasAtraso: 0,
      c: 0,
      v: 0,
    };
    g.creditos += 1;
    g.c += centavos(c.saldo);
    g.v += centavos(c.montoVencido);
    g.cuotasVencidas += c.cuotasVencidas;
    g.diasAtraso = Math.max(g.diasAtraso, c.diasAtraso);
    porCliente.set(c.clienteId, g);
  }
  return [...porCliente.values()]
    .map(({ c, v, ...g }) => ({ ...g, saldo: c / 100, montoVencido: v / 100 }))
    .sort(
      (a, b) =>
        b.diasAtraso - a.diasAtraso || b.saldo - a.saldo || a.nombre.localeCompare(b.nombre, "es"),
    );
}

// Cuotas vencidas (RF-CRE-05): los créditos con alguna cuota impaga pasada su fecha, los más atrasados primero.
export const vencidas = (cuentas: readonly Cuenta[]) =>
  cuentas.filter((c) => c.cuotasVencidas > 0).sort((a, b) => b.diasAtraso - a.diasAtraso);

export const ETIQUETA_ORIGEN: Record<Cuenta["origen"], string> = {
  venta: "Venta a crédito",
  saldo_inicial: "Saldo inicial",
};

const MENSAJES: Record<string, string> = {
  ERP_DATOS_INVALIDOS: "Revisa los datos: hay algo incompleto o inválido.",
  ERP_OPERACION_REPETIDA: "Esta operación ya se registró con otros datos; recarga la página.",
  ERP_SIN_PERMISO: "No tienes permiso para gestionar créditos.",
};
// Solo los códigos propios del crédito; el resto lo traduce usuarios/domain.
export const mensajeDeCredito = (codigo: string | undefined) =>
  codigo ? MENSAJES[codigo] : undefined;
