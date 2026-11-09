// Lectura del crédito en pantalla. Las cuentas (plan, mínimos, vencimientos) las calcula Postgres: plan_cuotas, simular_credito y
// cuentas_por_cobrar. Aquí no se recalcula plata ni fechas.

export const MAX_CUOTAS = 36;

export type CuotaPlan = { numero: number; capital: number; interes: number; monto: number };

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
  ERP_CREDITO_CON_PAGOS: "Ese crédito ya tiene pagos (o ya no está activo): no se puede anular.",
};
// Solo los códigos propios del crédito; el resto lo traduce usuarios/domain.
export const mensajeDeCredito = (codigo: string | undefined) =>
  codigo ? MENSAJES[codigo] : undefined;
