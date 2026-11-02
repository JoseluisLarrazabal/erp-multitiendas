import type { SupabaseClient } from "@supabase/supabase-js";
import {
  actualizarFila,
  conCerrojo,
  conFila,
  encolar,
  leerFila,
  leerFilas,
  marcarRechazada,
  marcarRed,
  quitar,
  quitarSiRechazada,
  type FilaCola,
  type FilaNueva,
  type ResultadoEnvio,
} from "@/lib/offline/cola";
import { MENSAJE_RED } from "@/lib/erp-errores";
import { MAX_INTENTOS_INESPERADOS } from "@/lib/offline/envio";
import type { Database } from "@/lib/supabase/database.types";
import { leerSesion } from "@/lib/supabase/sesion";
import {
  formatearNumero,
  MAX_NUMERO_DUPLICADO,
  secuenciaAgotada,
  siguienteSecuencia,
} from "./domain";
import { leerContador, subirContador } from "./equipo-local";
import { enviarVenta, existeVenta, type OfflineVenta } from "./queries";
import { payloadColaVentaSchema } from "./schemas";

export const TIPO_VENTA = "venta";
export const MENSAJE_AGOTADA = "Numeración del equipo agotada, avisa al encargado.";
const MENSAJE_DUPLICADOS =
  "No se pudo asignar un número de nota: otro equipo o pestaña los está usando. Recarga la página e intenta de nuevo.";
const MENSAJE_ILEGIBLE = "La venta guardada no se pudo leer. Avisa al encargado.";
export const MENSAJE_CUENTA =
  "La sesión caducó o es de otra cuenta. Vuelve a entrar con la misma cuenta que hizo esta venta; no la cobres de nuevo hasta comprobarla.";
const MENSAJE_INESPERADO =
  "El servidor devolvió un error inesperado varias veces seguidas. Avisa al encargado antes de reintentar.";
export const MENSAJE_COBRO_FALLIDO =
  "No se pudo completar el cobro. Revisa la lista de ventas antes de cobrar de nuevo.";
export const MENSAJE_CAMBIO =
  "La venta cambió mientras se comprobaba y ya no está rechazada. Revisa la lista.";
const MENSAJE_VOLVER_A_ENTRAR = "Vuelve a entrar con tu cuenta para comprobarla.";
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
    // Sin petición no hubo intento: pausa, no un fallo que suba `intentos` y la ponga en duda.
    if (sesion === "red" || sesion === "ninguna")
      return { resultado: { t: "pausa" }, numero: venta.numero };
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
    // ser transitorio y la venta ya se cobró: se reintenta hasta MAX_INTENTOS_INESPERADOS. Sin respuesta (r.red)
    // siempre se reintenta.
    const inesperado = !r.codigo && fila.intentos >= MAX_INTENTOS_INESPERADOS;
    if (r.red || (!r.codigo && !inesperado))
      return {
        resultado: { t: "red", error: r.error, respondio: !r.red },
        numero: venta.numero,
      };
    if (enDuda || r.codigo === "ERP_OPERACION_REPETIDA") {
      const existe = await existeVenta(supabase, venta.id);
      if (!existe.ok)
        return {
          resultado: { t: "red", error: existe.error, respondio: !existe.red },
          numero: venta.numero,
        };
      if (existe.data) return ok();
      enDuda = false; // no existe: los duplicados siguientes son de números que esta venta nunca guardó
    }
    if (r.codigo !== "ERP_NUMERO_DUPLICADO")
      return rechazo(inesperado ? MENSAJE_INESPERADO : r.error, r.codigo);
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
  // La venta ya se le entregó al cliente. `enviada`: llegó al servidor; si no, queda en la cola.
  | { t: "entregada"; numero: string; enviada: boolean }
  | { t: "rechazada"; error: string; codigo: string | null }
  | { t: "agotada" }
  | { t: "no-armada" }
  | { t: "no-guardada" }; // IndexedDB falló (o la fila está ocupada): no se cobra

export type PedidoCobro = {
  id: string;
  dispositivoId: string;
  // Último número que conoce esta pestaña; los de la cola y el contador local se leen bajo el cerrojo.
  ultimo: number;
  // Arma la fila con el número asignado. null: la venta no se pudo armar.
  armar: (seq: number) => FilaCobro | null;
};

// Primer intento de una venta, con el cerrojo de su fila de principio a fin (encolar, enviar, marcas): ningún vaciado
// de otra pestaña ni del motor la toca mientras tanto. El número se asigna y se encola bajo el cerrojo del equipo, que
// se suelta antes de la red. `enLinea` falso: sin primer intento, la fila queda lista.
export async function cobrarEnCola(
  pedido: PedidoCobro,
  supabase: SupabaseClient<Database>,
  enLinea: boolean,
): Promise<SalidaCobro> {
  const r = await conFila(pedido.id, async (): Promise<SalidaCobro> => {
    const preparada = await conCerrojo(
      `erp:numero:${pedido.dispositivoId}`,
      async (): Promise<SalidaCobro | { t: "lista"; fila: FilaCobro }> => {
        try {
          const enCola = await mayorSecuenciaEnCola(pedido.dispositivoId);
          const seq = siguienteSecuencia(pedido.ultimo, leerContador(pedido.dispositivoId), enCola);
          if (secuenciaAgotada(seq)) return { t: "agotada" };
          const armada = pedido.armar(seq);
          if (!armada) return { t: "no-armada" };
          // Sin red no habrá primer intento: la nota se entrega ya. Con red, hasta que termine el intento no.
          await encolar({ ...armada, entregada: !enLinea });
          subirContador(pedido.dispositivoId, seq);
          return { t: "lista", fila: armada };
        } catch {
          return { t: "no-guardada" };
        }
      },
    );
    if (preparada.t !== "lista") return preparada;
    const fila = preparada.fila;
    let salida: SalidaVenta;
    if (!enLinea)
      salida = { resultado: { t: "red", error: MENSAJE_RED }, numero: fila.numeroImpreso };
    else {
      try {
        salida = await enviarVentaDeCola({ ...fila, intentos: 0 }, supabase, true);
      } catch {
        // El primer intento pudo renumerar la fila: el número vigente es el de la fila, no el original.
        const vigente = await leerFila(fila.id).catch(() => null);
        salida = {
          resultado: { t: "red", error: MENSAJE_RED },
          numero: vigente?.numeroImpreso ?? fila.numeroImpreso,
        };
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
    // Desde aquí la nota se entrega: la fila que quede en la cola ya no es un primer intento interrumpido.
    const marcarEntregada = () =>
      actualizarFila(fila.id, { entregada: true }).catch(() => undefined);
    if (res.t === "ok") await quitar(fila.id).catch(marcarEntregada);
    else if (enLinea) {
      await marcarEntregada();
      // Sin red al confirmar no hubo intento, y no se cuenta como fallo.
      if (res.t === "red") await marcarRed(fila.id, res.error).catch(() => undefined);
    }
    return {
      t: "entregada",
      numero: salida.numero ?? fila.numeroImpreso,
      enviada: res.t === "ok",
    };
  });
  return r?.valor ?? { t: "no-guardada" };
}

// Envuelve el cobro entero: cualquier excepción inesperada (ya con la venta quizá encolada o enviada) no deja el
// cartel de "Enviando". Devuelve el mensaje de error, o null si todo fue bien.
export async function protegerCobro(fn: () => Promise<void>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch {
    return MENSAJE_COBRO_FALLIDO;
  }
}

export type Descarte = { t: "quitada" } | { t: "confirmar" } | { t: "error"; mensaje: string };

// Antes de descartar una venta rechazada se comprueba, con la cuenta de la página, que no esté ya en el servidor: si
// está, solo se quita de la lista. Con otra cuenta o la sesión caducada la RLS ocultaría la venta y no se puede
// comprobar: nunca se pide confirmar. Si no se puede comprobar, no se descarta.
export async function revisarDescarte(
  supabase: SupabaseClient<Database>,
  id: string,
  usuarioId: string,
  sesionCaducada: boolean,
): Promise<Descarte> {
  const volver = { t: "error", mensaje: MENSAJE_VOLVER_A_ENTRAR } as const;
  if (sesionCaducada) return volver;
  const cuenta = await comprobarCuenta(supabase, usuarioId);
  if (cuenta === "red")
    return {
      t: "error",
      mensaje:
        "No se pudo comprobar si la venta ya llegó al servidor. Revisa la conexión e intenta de nuevo.",
    };
  if (cuenta === "rechazar") return volver;
  const existe = await existeVenta(supabase, id);
  if (!existe.ok) return { t: "error", mensaje: existe.error };
  if (!existe.data) return { t: "confirmar" };
  return (await quitarSiRechazada(id)) ? { t: "quitada" } : { t: "error", mensaje: MENSAJE_CAMBIO };
}
