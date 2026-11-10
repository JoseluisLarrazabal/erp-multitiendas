// Segunda entrada del módulo, solo para páginas de /panel. Arrastra las server actions: si estuviera en
// index.ts, /pos (precacheado) cargaría sus referencias aunque no las use.
export { AnularVenta } from "./components/anular-venta";
export { DetalleVentaVista } from "./components/detalle-venta";
export { FiltrosVentasForm } from "./components/filtros-ventas";
export { FormDevolucion, type EquipoAbierto } from "./components/form-devolucion";
export { FormDatosNegocio } from "./components/form-datos-negocio";
export { FormTope } from "./components/form-tope";
export { ListaReconciliacion } from "./components/lista-reconciliacion";
export { ListaVentas } from "./components/lista-ventas";
export {
  EXPLICACION_ESPECIAL,
  fueraDePlazo,
  PAGINA_RECONCILIACION,
  PAGINA_VENTAS,
  PLAZO_HORAS,
  permiteAnularODevolver,
  textoPorRevisar,
} from "./domain-panel";
export {
  detalleVenta,
  listarEquiposPanel,
  listarReconciliacion,
  listarVentas,
  sesionesAbiertas,
  type DetalleVenta,
} from "./lecturas-panel";
export { AnularOrden } from "./components/anular-orden";
export { DetalleOrdenVista } from "./components/detalle-orden";
export { FiltrosOrdenesForm } from "./components/filtros-ordenes";
export { ListaOrdenes } from "./components/lista-ordenes";
export { detalleOrden, listarOrdenes } from "./lecturas-ordenes";
export { ANULABLES, hrefOrdenes, leerFiltrosOrdenes, PAGINA_ORDENES } from "./schemas-ordenes";
export { cargarNegocio } from "./queries";
export { hrefVentas, leerDesdeReconciliacion, leerFiltrosVentas } from "./schemas-panel";
