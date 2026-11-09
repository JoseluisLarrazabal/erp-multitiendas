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
  frecuencia: z.string(),
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
});
export const leerCuentas = (json: unknown): Cuenta[] | null => {
  const r = z.array(cuentaSchema).safeParse(json);
  return r.success
    ? r.data.map((c) => ({
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
      }))
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
  pagos: z.array(z.object({ monto: z.number(), medio: z.string(), creado_en: z.string() })),
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
    inicialPct: z.string().refine((t) => pctValido(t, 99.99)),
    interesPct: z.string().refine((t) => pctValido(t, 100)),
    plazoCuotas: z.coerce.number().int().min(1).max(MAX_CUOTAS),
    maxCuotas: z.coerce.number().int().min(1).max(MAX_CUOTAS),
  })
  .refine((d) => d.plazoCuotas <= d.maxCuotas, { path: ["plazoCuotas"] });

function pctValido(texto: string, tope: number) {
  const c = parsearMonto(texto);
  return c !== null && c <= tope * 100;
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
