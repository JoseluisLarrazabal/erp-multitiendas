// Entrada pública sin server actions (la usa /pos). Las páginas de /panel usan ./panel.
export { agruparPorCliente, MAX_CUOTAS, vencidas, type Cuenta, type CuotaPlan } from "./domain";
export {
  cargarCuentas,
  cargarDetalle,
  cargarParametros,
  enviarPagoCuota,
  existePagoCuota,
  simularCredito,
} from "./queries";
export {
  pagoCuotaSchema,
  type DetalleCredito,
  type PagoCuotaPayload,
  type Parametros,
  type Simulacion,
} from "./schemas";
