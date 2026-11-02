// Entrada pública, sin server actions: /pos la usa desde el cliente.
export { AperturaCaja } from "./components/apertura-caja";
export { PanelCaja } from "./components/panel-caja";
export { cajaAbierta } from "./queries";
export type { SesionCaja } from "./schemas";
export {
  aperturaEnCola,
  describirOperacionCaja,
  enviarAperturaDeCola,
  enviarMovimientoDeCola,
  hayAperturaEnCola,
  movimientosDeSesion,
  TIPO_APERTURA,
  TIPO_MOVIMIENTO,
} from "./cola-caja";
export { guardarCajaLocal, leerCajaLocal } from "./contexto";
