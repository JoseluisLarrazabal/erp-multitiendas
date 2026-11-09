// Cobro online-only (venta de reserva o a crédito, cuota): el mismo pedido idempotente se reintenta en memoria mientras no haya
// respuesta del servidor, y al final se pregunta si quedó registrado. Un solo lazo para todos los cobros directos.
export type Intento<T> =
  // El servidor respondió y el cobro quedó hecho.
  | { t: "hecho"; valor: T }
  // El servidor respondió y lo rechazó (o hay que dejarlo así): no se reintenta.
  | { t: "definitivo"; valor: T }
  // Sin respuesta: la base pudo haberlo guardado.
  | { t: "duda" };

const ESPERAS_MS = [1000, 2000, 4000];

export async function reintentarHastaConfirmar<T>(o: {
  // `i` = reintentos ya hechos por falta de respuesta.
  intentar: (i: number) => Promise<Intento<T>>;
  // Tras agotar los reintentos: el valor si el cobro quedó registrado, null si no (o no se pudo saber).
  existe: () => Promise<T | null>;
  // Cada vez que un intento queda en duda (estado bloqueante en pantalla).
  alDuda: () => void;
  esperar?: (ms: number) => Promise<void>;
}): Promise<{ t: "hecho" | "definitivo"; valor: T } | { t: "sin-confirmar" }> {
  const esperar = o.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let i = 0; ; i++) {
    const r = await o.intentar(i);
    if (r.t !== "duda") return r;
    o.alDuda();
    if (i >= ESPERAS_MS.length) {
      const valor = await o.existe();
      return valor === null ? { t: "sin-confirmar" } : { t: "hecho", valor };
    }
    await esperar(ESPERAS_MS[i]!);
  }
}
