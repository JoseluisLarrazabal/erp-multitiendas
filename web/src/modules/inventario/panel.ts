// Segunda entrada del módulo, solo para páginas de /panel. Arrastra las server actions: si estuviera en
// index.ts, /pos y /login (precacheados) cargarían sus referencias aunque no las usen.
export { FiltrosStockForm } from "./components/filtros-stock";
export { FormConsumo } from "./components/form-consumo";
export { FormConteo } from "./components/form-conteo";
export { FormEntrada } from "./components/form-entrada";
export { FormSalida } from "./components/form-salida";
export { FormSeries } from "./components/form-series";
export { FormTraslado } from "./components/form-traslado";
export { ListaKardex } from "./components/lista-kardex";
export { ListaStock } from "./components/lista-stock";
export { ListaVencimientos } from "./components/lista-vencimientos";
export { PaginaOperacion } from "./components/pagina-operacion";
export { ResumenStock } from "./components/resumen-stock";
export {
  contarStockBajo,
  leerKardex,
  leerLotesPorVencer,
  listarStock,
  obtenerProductoInventario,
  stockPorUbicacion,
} from "./queries";
