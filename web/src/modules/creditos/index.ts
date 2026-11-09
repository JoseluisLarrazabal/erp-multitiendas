// Entrada pública sin server actions (la usa /pos). Las páginas de /panel usan ./panel.
export {
  agruparPorCliente,
  aCentesimas,
  diasEntre,
  fechaCorta,
  hoyLaPaz,
  inicialMinima,
  MAX_CUOTAS,
  planCuotas,
  sumarMeses,
  vencidas,
  vencimiento,
  type Cuenta,
  type CuotaPlan,
} from "./domain";
export {
  cargarCuentas,
  cargarDetalle,
  cargarParametros,
  enviarPagoCuota,
  existePagoCuota,
} from "./queries";
export {
  pagoCuotaSchema,
  type DetalleCredito,
  type PagoCuotaPayload,
  type Parametros,
} from "./schemas";
