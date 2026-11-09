"use server";

// Solo para el panel (se importa por panel.ts). No importar desde /pos: ver usuarios/actions.ts.
import { revalidatePath } from "next/cache";
import { parsearMonto } from "@/lib/format/moneda";
import { createClient } from "@/lib/supabase/server";
import {
  codigoDeMensaje,
  mensajeDeError as mensajeBase,
  validar,
  type Resultado,
} from "@/modules/usuarios/panel";
import { mensajeDeCredito } from "./domain";
import { configSchema, saldoInicialSchema } from "./schemas";

const fallo = (codigo?: string): Resultado<never> => ({
  ok: false,
  error: mensajeDeCredito(codigo) ?? mensajeBase(codigo),
});
const listo = (): Resultado<null> => {
  revalidatePath("/panel/creditos");
  return { ok: true, data: null };
};

export async function guardarCreditoConfig(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(configSchema, entrada);
  const inicial = d && parsearMonto(d.inicialPct);
  const interes = d && parsearMonto(d.interesPct);
  if (!d || inicial === null || interes === null) return fallo("ERP_DATOS_INVALIDOS");
  const { error } = await (
    await createClient()
  ).rpc("guardar_credito_config", {
    p_negocio_id: d.negocioId,
    p_inicial_pct: inicial / 100,
    p_plazo_cuotas: d.plazoCuotas,
    p_max_cuotas: d.maxCuotas,
    p_interes_mensual_pct: interes / 100,
  });
  return error ? fallo(codigoDeMensaje(error.message)) : listo();
}

export async function crearCreditoInicial(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(saldoInicialSchema, entrada);
  const capital = d && parsearMonto(d.capital);
  if (!d || !capital) return fallo("ERP_DATOS_INVALIDOS");
  const { error } = await (
    await createClient()
  ).rpc("crear_credito_inicial", {
    p_id: d.operacionId,
    p_negocio_id: d.negocioId,
    p_cliente_id: d.clienteId,
    p_capital: capital / 100,
    p_cuotas: d.cuotas,
    p_primera: d.primera,
  });
  return error ? fallo(codigoDeMensaje(error.message)) : listo();
}
