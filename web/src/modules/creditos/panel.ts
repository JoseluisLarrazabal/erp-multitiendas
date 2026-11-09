// Segunda entrada del módulo, solo para páginas de /panel. Arrastra las server actions: si estuviera en
// index.ts, /pos (precacheado) cargaría sus referencias aunque no las use.
export { DetalleCreditoVista } from "./components/detalle-credito";
export { FormConfigCredito } from "./components/form-config";
export { FormSaldoInicial } from "./components/form-saldo-inicial";
export { TablaSaldos, TablaVencidas } from "./components/tablas-cuentas";
export { agruparPorCliente } from "./domain";
export { cargarClientesConSaldo, cargarCuentas, cargarDetalle, cargarParametros } from "./queries";
export { leerFiltrosCreditos, PAGINA_CREDITOS } from "./schemas";
