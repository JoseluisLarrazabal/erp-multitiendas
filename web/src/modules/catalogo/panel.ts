// Segunda entrada del módulo, solo para páginas de /panel. Arrastra las server actions: si estuviera en
// index.ts, /pos y /login (precacheados) cargarían sus referencias aunque no las usen.
export { EncabezadoPagina, Seccion } from "./components/encabezado-pagina";
export { EstadoProducto } from "./components/estado-producto";
export { FiltrosBusqueda } from "./components/filtros-busqueda";
export { FormCategoria } from "./components/form-categoria";
export { FormProducto } from "./components/form-producto";
export { FormTipoCambio } from "./components/form-tipo-cambio";
export { GrillaPrecios } from "./components/grilla-precios";
export { ListaProductos } from "./components/lista-productos";
export { Paginador } from "./components/paginador";
export {
  filasDePrecios,
  historialTipoCambio,
  listarCategorias,
  listarMarcas,
  listarProductos,
  obtenerProducto,
  tipoCambioVigente,
  urlsDeFotos,
} from "./queries";
