import type { CuotaPlan, Simulacion } from "@/modules/creditos";
import { aCentavos, bs, parsearMonto } from "./domain";

// Venta a crédito en el POS (RF-CRE-01): lo que el cajero escribe y lo que devuelve simular_credito. El mínimo, el plan y los
// vencimientos los calcula Postgres con la misma regla que registrar_venta; aquí solo se interpreta la respuesta (centavos).
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
export type ResultadoCredito = { ok: true; plan: PlanVenta } | { ok: false; motivo: string };

// Vacío = el valor por defecto del negocio (inicial mínima, plazo por defecto): el servidor lo resuelve (null).
export function pedirSimulacion(
  form: FormCredito,
  totalCentavos: number,
):
  | { ok: true; total: number; inicial: number | null; cuotas: number | null }
  | { ok: false; motivo: string } {
  if (totalCentavos <= 0) return { ok: false, motivo: "El total debe ser mayor a cero." };
  const inicial = form.inicialTexto.trim() === "" ? null : parsearMonto(form.inicialTexto);
  if (form.inicialTexto.trim() !== "" && (inicial === null || inicial <= 0))
    return { ok: false, motivo: "La inicial es inválida." };
  const crudo = form.cuotasTexto.trim();
  const cuotas = crudo === "" ? null : /^\d{1,3}$/.test(crudo) ? Number(crudo) : NaN;
  if (cuotas !== null && !(cuotas >= 1))
    return { ok: false, motivo: "Las cuotas deben ser un entero desde 1." };
  return {
    ok: true,
    total: totalCentavos / 100,
    inicial: inicial === null ? null : inicial / 100,
    cuotas,
  };
}

export function leerPlan(s: Simulacion): ResultadoCredito {
  if (s.error === "ERP_INICIAL_INSUFICIENTE")
    return {
      ok: false,
      motivo: `La inicial mínima es ${bs(aCentavos(s.minimo))} (${String(s.inicial_pct).replace(".", ",")} % del total).`,
    };
  if (s.error)
    return {
      ok: false,
      motivo: `Revisa la inicial y las cuotas (1 a ${s.max_cuotas}): la inicial debe ser menor al total y el saldo a financiar no muy chico.`,
    };
  return {
    ok: true,
    plan: {
      inicial: aCentavos(s.inicial),
      minimo: aCentavos(s.minimo),
      cuotas: s.cuotas,
      financiado: aCentavos(s.financiado),
      plan: s.plan.map((p) => ({
        fila: {
          numero: p.numero,
          capital: aCentavos(p.capital),
          interes: aCentavos(p.interes),
          monto: aCentavos(p.monto),
        },
        vence: p.vence_en,
      })),
    },
  };
}
