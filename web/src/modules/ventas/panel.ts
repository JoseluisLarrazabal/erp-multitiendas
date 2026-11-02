// Segunda entrada del módulo, solo para páginas de /panel. Arrastra las server actions: si estuviera en
// index.ts, /pos (precacheado) cargaría sus referencias aunque no las use.
export { AnularVenta } from "./components/anular-venta";
export { DetalleVentaVista } from "./components/detalle-venta";
export { FiltrosVentasForm } from "./components/filtros-ventas";
export { FormDevolucion, type EquipoAbierto } from "./components/form-devolucion";
export { FormTope } from "./components/form-tope";
export { ListaReconciliacion } from "./components/lista-reconciliacion";
export { ListaVentas } from "./components/lista-ventas";
export { fueraDePlazo, PAGINA_RECONCILIACION, PAGINA_VENTAS, PLAZO_HORAS } from "./domain-panel";
export {
  detalleVenta,
  listarEquiposPanel,
  listarReconciliacion,
  listarVentas,
  sesionesAbiertas,
  type DetalleVenta,
} from "./lecturas-panel";
export { cargarNegocio } from "./queries";
export { hrefVentas, leerDesdeReconciliacion, leerFiltrosVentas } from "./schemas-panel";
