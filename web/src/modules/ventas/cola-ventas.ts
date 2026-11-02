import type { SupabaseClient } from "@supabase/supabase-js";
import {
  actualizarFila,
  conFila,
  encolar,
  leerFilas,
  marcarRechazada,
  marcarRed,
  quitar,
  type FilaCola,
  type FilaNueva,
  type ResultadoEnvio,
} from "@/lib/offline/cola";
import { MENSAJE_RED } from "@/lib/erp-errores";
import type { Database } from "@/lib/supabase/database.types";
import {
  formatearNumero,
  MAX_NUMERO_DUPLICADO,
  secuenciaAgotada,
  siguienteSecuencia,
} from "./domain";
import { leerContador, subirContador } from "./equipo-local";
import { enviarVenta, existeVenta, TIEMPO_ENVIO_MS, type OfflineVenta } from "./queries";
import { payloadColaVentaSchema } from "./schemas";

export const TIPO_VENTA = "venta";
export const MENSAJE_AGOTADA = "Numeración del equipo agotada, avisa al encargado.";
const MENSAJE_DUPLICADOS =
  "No se pudo asignar un número de nota: otro equipo o pestaña los está usando. Recarga la página e intenta de nuevo.";
const MENSAJE_ILEGIBLE = "La venta guardada no se pudo leer. Avisa al encargado.";
export const MENSAJE_CUENTA =
  "La sesión caducó o es de otra cuenta. Vuelve a entrar con la misma cuenta que hizo esta venta; no la cobres de nuevo hasta comprobarla.";
const MENSAJE_LIMPIEZA =
  "La venta no se pudo limpiar de este equipo. Recarga la página antes de cobrarla de nuevo.";

export type EntradaVenta = Pick<
  FilaCola,
  "id" | "usuarioId" | "dispositivoId" | "payload" | "nota" | "numeroImpreso" | "intentos"
>;
export type SalidaVenta = { resultado: ResultadoEnvio; numero: string | null };

export const secuenciaDe = (numero: string) =>
  Number(numero.slice(numero.lastIndexOf("-") + 1)) || 0;

// Mayor número de nota que el equipo tiene en la cola (el impreso también cuenta: ese número ya salió al cliente).
export async function mayorSecuenciaEnCola(dispositivoId: string): Promise<number> {
  const { filas } = await leerFilas();
  let mayor = 0;
  for (const f of filas) {
    if (f.tipo !== TIPO_VENTA || f.dispositivoId !== dispositivoId) continue;
    const p = payloadColaVentaSchema.safeParse(f.payload);
    mayor = Math.max(mayor, p.success ? secuenciaDe(p.data.venta.numero) : 0);
    if (f.numeroImpreso) mayor = Math.max(mayor, secuenciaDe(f.numeroImpreso));
  }
  return mayor;
}

// "red": no se pudo saber (sin red, error de Auth o más de 8 s). "ninguna": no hay sesión definitiva.
export type SesionLeida = "red" | "ninguna" | { usuarioId: string };

export async function leerSesion(supabase: SupabaseClient<Database>): Promise<SesionLeida> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  try {
    const limite = new Promise<never>((_, no) => {
      reloj = setTimeout(() => no(new Error("sin respuesta")), TIEMPO_ENVIO_MS);
    });
    const { data, error } = await Promise.race([supabase.auth.getSession(), limite]);
    if (error) return "red";
    return data.session ? { usuarioId: data.session.user.id } : "ninguna";
  } catch {
    return "red";
  } finally {
    clearTimeout(reloj);
  }
}

// Al cobrar con red: la RLS ocultaría una venta ya guardada si la sesión es de otra cuenta o no existe, y no habría
// forma de comprobarla. "red" cuenta como sin red: la venta entra a la cola.
export async function comprobarCuenta(
  supabase: SupabaseClient<Database>,
  usuarioId: string,
): Promise<"ok" | "rechazar" | "red"> {
  const s = await leerSesion(supabase);
  if (s === "red") return "red";
  return s !== "ninguna" && s.usuarioId === usuarioId ? "ok" : "rechazar";
}

// Envía una venta de la cola. `primerIntento`: en línea, sin p_offline, y un rechazo con código es definitivo (la
// venta sale de la cola y vuelve al carrito). Los reenvíos van con p_offline. El UUID se conserva siempre; solo
// ERP_NUMERO_DUPLICADO cambia el número (la base no guardó nada) y se persiste antes de enviar.
// `fila.intentos > 0` es "en duda": un intento anterior terminó sin respuesta y la base pudo guardar la venta, así
// que antes de renumerar o rechazar se comprueba con existeVenta.
export async function enviarVentaDeCola(
  fila: EntradaVenta,
  supabase: SupabaseClient<Database>,
  primerIntento: boolean,
): Promise<SalidaVenta> {
  const p = payloadColaVentaSchema.safeParse(fila.payload);
  if (!p.success)
    return { resultado: { t: "rechazo", error: MENSAJE_ILEGIBLE }, numero: fila.numeroImpreso };
  const { tipo_cambio: tipoCambio } = p.data;
  let venta = p.data.venta;
  // El primer intento ya comprobó la cuenta al cobrar. Un reenvío con la sesión de otra cuenta sí sale: el servidor
  // marca `otra_cuenta` y la venta conserva a quien vendió.
  if (!primerIntento) {
    const sesion = await leerSesion(supabase);
    if (sesion === "red")
      return { resultado: { t: "red", error: MENSAJE_RED }, numero: venta.numero };
    if (sesion === "ninguna") return { resultado: { t: "pausa" }, numero: venta.numero };
  }

  const ok = (): SalidaVenta => {
    subirContador(fila.dispositivoId, secuenciaDe(venta.numero));
    return { resultado: { t: "ok" }, numero: venta.numero };
  };
  const rechazo = (error: string, codigo: string | null = null): SalidaVenta => ({
    resultado: { t: "rechazo", error, codigo },
    numero: venta.numero,
  });
  let enDuda = fila.intentos > 0;
  for (let duplicados = 0; ; duplicados++) {
    const offline: OfflineVenta | undefined = primerIntento
      ? undefined
      : {
          vendedor_id: fila.usuarioId,
          tipo_cambio: tipoCambio,
          numero_impreso: fila.numeroImpreso,
        };
    const r = await enviarVenta(supabase, venta, offline);
    if (r.ok) return ok();
    // Solo un código ERP_ es una respuesta definitiva de la base; cualquier otro fallo (PGRST, 40P01, 5xx) puede
    // ser transitorio y la venta ya se cobró.
    if (r.red || !r.codigo)
      return { resultado: { t: "red", error: r.error }, numero: venta.numero };
    if (enDuda || r.codigo === "ERP_OPERACION_REPETIDA") {
      const existe = await existeVenta(supabase, venta.id);
      if (!existe.ok) return { resultado: { t: "red", error: existe.error }, numero: venta.numero };
      if (existe.data) return ok();
      enDuda = false; // no existe: los duplicados siguientes son de números que esta venta nunca guardó
    }
    if (r.codigo !== "ERP_NUMERO_DUPLICADO") return rechazo(r.error, r.codigo);
    if (duplicados >= MAX_NUMERO_DUPLICADO) return rechazo(MENSAJE_DUPLICADOS, r.codigo);

    subirContador(fila.dispositivoId, secuenciaDe(venta.numero)); // ese número ya es de otra venta
    const seq = siguienteSecuencia(
      secuenciaDe(venta.numero),
      leerContador(fila.dispositivoId),
      await mayorSecuenciaEnCola(fila.dispositivoId),
    );
    if (secuenciaAgotada(seq)) return rechazo(MENSAJE_AGOTADA, r.codigo);
    const numero = formatearNumero(venta.numero.slice(0, venta.numero.lastIndexOf("-")), seq);
    venta = { ...venta, numero };
    // La nota aún no salió al cliente solo en el primer intento: ahí cambia con el número. Después conserva el
    // número impreso y el servidor marca `renumerada`.
    const nota = fila.nota;
    await actualizarFila(fila.id, {
      payload: { venta, tipo_cambio: tipoCambio },
      ...(primerIntento
        ? {
            numeroImpreso: numero,
            nota:
              typeof nota === "object" && nota !== null && !Array.isArray(nota)
                ? { ...nota, numero }
                : nota,
          }
        : {}),
    });
  }
}

export type FilaCobro = FilaNueva & { numeroImpreso: string };
export type SalidaCobro =
  | { t: "entregada"; numero: string } // ok, o la venta queda en la cola: ya se le entregó al cliente
  | { t: "rechazada"; error: string; codigo: string | null }
  | { t: "no-guardada" }; // IndexedDB falló (o la fila está ocupada): no se cobra

// Primer intento de una venta, con el cerrojo de su fila de principio a fin (encolar, enviar, marcas): ningún vaciado
// de otra pestaña ni del motor la toca mientras tanto. `enLinea` falso: sin primer intento, la fila queda lista.
export async function cobrarEnCola(
  fila: FilaCobro,
  supabase: SupabaseClient<Database>,
  enLinea: boolean,
): Promise<SalidaCobro> {
  const r = await conFila(fila.id, async (): Promise<SalidaCobro> => {
    try {
      await encolar(fila);
    } catch {
      return { t: "no-guardada" };
    }
    let salida: SalidaVenta;
    if (!enLinea)
      salida = { resultado: { t: "red", error: MENSAJE_RED }, numero: fila.numeroImpreso };
    else {
      try {
        salida = await enviarVentaDeCola({ ...fila, intentos: 0 }, supabase, true);
      } catch {
        salida = { resultado: { t: "red", error: MENSAJE_RED }, numero: fila.numeroImpreso };
      }
    }
    const res = salida.resultado;
    if (res.t === "rechazo") {
      try {
        await quitar(fila.id);
      } catch {
        // Si queda en la cola, el motor la reenviaría con p_offline y podría aceptarla: se frena.
        await marcarRechazada(fila.id, res.error).catch(() => undefined);
        return { t: "rechazada", error: MENSAJE_LIMPIEZA, codigo: null };
      }
      return { t: "rechazada", error: res.error, codigo: res.codigo ?? null };
    }
    if (res.t === "ok") await quitar(fila.id).catch(() => undefined);
    // Sin red al confirmar no hubo intento, y no se cuenta como fallo.
    else if (res.t === "red" && enLinea) await marcarRed(fila.id, res.error).catch(() => undefined);
    return { t: "entregada", numero: salida.numero ?? fila.numeroImpreso };
  });
  return r?.valor ?? { t: "no-guardada" };
}

export type Descarte = { t: "quitada" } | { t: "confirmar" } | { t: "error"; mensaje: string };

// Antes de descartar una venta rechazada se comprueba, con la cuenta activa, que no esté ya en el servidor: si está,
// solo se quita de la lista. Si no se puede comprobar, no se descarta.
export async function revisarDescarte(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<Descarte> {
  const sesion = await leerSesion(supabase);
  if (sesion === "red")
    return {
      t: "error",
      mensaje:
        "No se pudo comprobar si la venta ya llegó al servidor. Revisa la conexión e intenta de nuevo.",
    };
  if (sesion === "ninguna")
    return { t: "error", mensaje: "Inicia sesión para comprobar la venta antes de descartarla." };
  const existe = await existeVenta(supabase, id);
  if (!existe.ok) return { t: "error", mensaje: existe.error };
  if (!existe.data) return { t: "confirmar" };
  await quitar(id);
  return { t: "quitada" };
}
