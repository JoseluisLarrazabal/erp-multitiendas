import {
  inicialMinima,
  planCuotas,
  vencimiento,
  type CuotaPlan,
  type Parametros,
} from "@/modules/creditos";
import { bs, parsearMonto } from "./domain";

// Venta a crédito en el POS (RF-CRE-01): lo que el cajero escribe, validado con las mismas reglas que registrar_venta.
// Todo en centavos. El servidor decide: esto solo evita viajes inútiles y muestra el plan antes de cobrar.
export type FormCredito = {
  activo: boolean;
  inicialTexto: string;
  cuotasTexto: string;
  docsCi: boolean;
  docsDomicilio: boolean;
  docsPagare: boolean;
};

export const formCreditoInicial: FormCredito = {
  activo: false,
  inicialTexto: "",
  cuotasTexto: "",
  docsCi: false,
  docsDomicilio: false,
  docsPagare: false,
};

export type PlanVenta = {
  inicial: number;
  minimo: number;
  cuotas: number;
  financiado: number;
  plan: { fila: CuotaPlan; vence: string }[];
};

// Cuotas en pantalla: vacío = el plazo por defecto del negocio.
export const cuotasDe = (f: FormCredito, p: Parametros) =>
  f.cuotasTexto.trim() === "" ? p.plazoCuotas : Number(f.cuotasTexto.trim());

export function armarCredito(o: {
  form: FormCredito;
  parametros: Parametros | null;
  total: number;
  hayCliente: boolean;
  hoy: string;
}): { ok: true; plan: PlanVenta } | { ok: false; motivo: string } {
  const { form, parametros, total } = o;
  if (!parametros) return { ok: false, motivo: "Cargando los parámetros del crédito…" };
  if (!o.hayCliente) return { ok: false, motivo: "El crédito necesita un cliente." };
  if (total <= 0) return { ok: false, motivo: "El total debe ser mayor a cero." };
  const minimo = inicialMinima(total, parametros.inicialPct);
  const inicial = form.inicialTexto.trim() === "" ? minimo : parsearMonto(form.inicialTexto);
  if (inicial === null || inicial <= 0) return { ok: false, motivo: "La inicial es inválida." };
  if (inicial < minimo)
    return {
      ok: false,
      motivo: `La inicial mínima es ${bs(minimo)} (${String(parametros.inicialPct).replace(".", ",")} % del total).`,
    };
  if (inicial >= total)
    return { ok: false, motivo: "La inicial debe ser menor al total: no quedaría nada a crédito." };
  const cuotas = cuotasDe(form, parametros);
  if (!Number.isInteger(cuotas) || cuotas < 1 || cuotas > parametros.maxCuotas)
    return { ok: false, motivo: `Las cuotas van de 1 a ${parametros.maxCuotas}.` };
  const financiado = total - inicial;
  const filas = planCuotas(financiado, parametros.interesMensualPct, cuotas);
  if (filas.length === 0) return { ok: false, motivo: "El saldo es muy chico para tantas cuotas." };
  return {
    ok: true,
    plan: {
      inicial,
      minimo,
      cuotas,
      financiado,
      plan: filas.map((fila) => ({ fila, vence: vencimiento(o.hoy, fila.numero) })),
    },
  };
}
