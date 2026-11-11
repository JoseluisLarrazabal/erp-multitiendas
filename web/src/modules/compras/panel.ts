// Segunda entrada del módulo, solo para páginas de /panel. Arrastra las server actions: si estuviera en
// index.ts, /pos (precacheado) cargaría sus referencias aunque no las use.
export { FormCompra } from "./components/form-compra";
export { ListaCompras } from "./components/lista-compras";
export { ListaProveedores, NuevoProveedor } from "./components/proveedores-panel";
export { listarCompras, listarProveedores, resumenDeudaProveedores } from "./queries";
export { leerFiltrosCompras, PAGINA_COMPRAS } from "./schemas";
