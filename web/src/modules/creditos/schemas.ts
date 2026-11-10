import { z } from "zod";
import { leerFiltros } from "@/lib/filtros";
import { parsearMonto } from "@/lib/format/moneda";
import { MAX_CUOTAS, type Cuenta } from "./domain";

// Respuestas de las RPC de crédito (numeric llega como número): se validan antes de usarlas.
export const parametrosSchema = z.object({
  inicial_pct: z.number(),
  plazo_cuotas: z.number(),
  max_cuotas: z.number(),
  interes_mensual_pct: z.number(),
});
export type Parametros = {
  inicialPct: number;
  plazoCuotas: number;
  maxCuotas: number;
  interesMensualPct: number;
};
export const leerParametros = (json: unknown): Parametros | null => {
  const r = z.array(parametrosSchema).length(1).safeParse(json);
  const p = r.success ? r.data[0] : undefined;
  return p
    ? {
        inicialPct: p.inicial_pct,
        plazoCuotas: p.plazo_cuotas,
        maxCuotas: p.max_cuotas,
        interesMensualPct: p.interes_mensual_pct,
      }
    : null;
};

const cuentaSchema = z.object({
  credito_id: z.guid(),
  cliente_id: z.guid(),
  cliente_nombre: z.string(),
  cliente_documento: z.string().nullable(),
  origen: z.enum(["venta", "saldo_inicial"]),
  venta_numero: z.string().nullable(),
  creado_en: z.string(),
  total: z.number(),
  pagado: z.number(),
  saldo: z.number(),
  cuotas_vencidas: z.number(),
  monto_vencido: z.number(),
  dias_atraso: z.number(),
  proxima_vence: z.string().nullable(),
  proxima_monto: z.number().nullable(),
  total_filas: z.number(),
});
// `total` = unidades de la página en total (clientes, o créditos vencidos con p_solo_vencidas), para el paginador.
export const leerCuentas = (json: unknown): { cuentas: Cuenta[]; total: number } | null => {
  const r = z.array(cuentaSchema).safeParse(json);
  return r.success
    ? {
        total: r.data[0]?.total_filas ?? 0,
        cuentas: r.data.map((c) => ({
          creditoId: c.credito_id,
          clienteId: c.cliente_id,
          clienteNombre: c.cliente_nombre,
          clienteDocumento: c.cliente_documento,
          origen: c.origen,
          ventaNumero: c.venta_numero,
          creadoEn: c.creado_en,
          total: c.total,
          pagado: c.pagado,
          saldo: c.saldo,
          cuotasVencidas: c.cuotas_vencidas,
          montoVencido: c.monto_vencido,
          diasAtraso: c.dias_atraso,
          proximaVence: c.proxima_vence,
          proximoMonto: c.proxima_monto ?? 0,
        })),
      }
    : null;
};

const detalleSchema = z.object({
  id: z.guid(),
  cliente_nombre: z.string(),
  cliente_documento: z.string().nullable(),
  origen: z.enum(["venta", "saldo_inicial"]),
  venta_numero: z.string().nullable(),
  capital: z.number(),
  inicial: z.number(),
  interes_mensual_pct: z.number(),
  estado: z.string(),
  motivo_anulacion: z.string().nullable(),
  docs_ci: z.boolean(),
  docs_domicilio: z.boolean(),
  docs_pagare: z.boolean(),
  creado_en: z.string(),
  total: z.number(),
  pagado: z.number(),
  saldo: z.number(),
  cuotas: z.array(
    z.object({
      numero: z.number(),
      vence_en: z.string(),
      capital: z.number(),
      interes: z.number(),
      monto: z.number(),
      pagado: z.number(),
      pendiente: z.number(),
      dias_atraso: z.number(),
    }),
  ),
  pagos: z.array(
    z.object({
      monto: z.number(),
      medio: z.string(),
      creado_en: z.string(),
      operacion_id: z.guid(),
      anula_operacion_id: z.guid().nullable(),
      motivo: z.string().nullable(),
    }),
  ),
  // El pago que se puede anular (el último vivo) o null.
  ultimo_pago_id: z.guid().nullable(),
});
export type DetalleCredito = z.infer<typeof detalleSchema>;
export const leerDetalle = (json: unknown): DetalleCredito | null => {
  const r = detalleSchema.safeParse(json);
  return r.success ? r.data : null;
};

// Entradas de las server actions del panel.
export const configSchema = z
  .object({
    negocioId: z.guid(),
    inicialPct: z.string().refine((t) => pctValido(t, 99.99, true)),
    interesPct: z.string().refine((t) => pctValido(t, 100, false)),
    plazoCuotas: z.coerce.number().int().min(1).max(MAX_CUOTAS),
    maxCuotas: z.coerce.number().int().min(1).max(MAX_CUOTAS),
  })
  .refine((d) => d.plazoCuotas <= d.maxCuotas, { path: ["plazoCuotas"] });

function pctValido(texto: string, tope: number, positivo: boolean) {
  const c = parsearMonto(texto);
  return c !== null && c <= tope * 100 && (!positivo || c > 0);
}

export const saldoInicialSchema = z.object({
  operacionId: z.guid(),
  negocioId: z.guid(),
  clienteId: z.guid(),
  capital: z.string().refine((t) => (parsearMonto(t) ?? 0) > 0),
  cuotas: z.coerce.number().int().min(1).max(MAX_CUOTAS),
  primera: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Payload de pagar_cuota: mismas claves que el servidor.
export const pagoCuotaSchema = z.strictObject({
  id: z.guid(),
  credito_id: z.guid(),
  dispositivo_id: z.guid(),
  caja_sesion_id: z.guid(),
  efectivo: z.number().min(0),
  qr: z.number().min(0),
});
export type PagoCuotaPayload = z.infer<typeof pagoCuotaSchema>;

export const PAGINA_CREDITOS = 25;
export const leerFiltrosCreditos = (crudo: Parameters<typeof leerFiltros>[2]) =>
  leerFiltros({ pagina: z.coerce.number().int().min(1).max(10_000) }, { pagina: 1 }, crudo);

export const anularInicialSchema = z.object({
  operacionId: z.guid(),
  creditoId: z.guid(),
  motivo: z.string().trim().min(1).max(200),
});

// Respuesta de simular_credito: el plan, el mínimo y el error los fija Postgres.
const simulacionSchema = z.object({
  error: z.string().nullable(),
  minimo: z.number(),
  inicial: z.number(),
  cuotas: z.number(),
  financiado: z.number(),
  max_cuotas: z.number(),
  inicial_pct: z.number(),
  plan: z.array(
    z.object({
      numero: z.number(),
      capital: z.number(),
      interes: z.number(),
      monto: z.number(),
      vence_en: z.string(),
    }),
  ),
});
export type Simulacion = z.infer<typeof simulacionSchema>;
export const leerSimulacion = (json: unknown): Simulacion | null => {
  const r = simulacionSchema.safeParse(json);
  return r.success ? r.data : null;
};

export const anularPagoSchema = z.object({
  operacionId: z.guid(),
  pagoOperacionId: z.guid(),
  sesionId: z.guid(),
  dispositivoId: z.guid(),
  motivo: z.string().trim().min(1).max(200),
});

export const documentosSchema = z.object({
  creditoId: z.guid(),
  ci: z.boolean(),
  domicilio: z.boolean(),
  pagare: z.boolean(),
});
