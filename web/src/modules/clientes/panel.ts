// Segunda entrada del módulo, solo para páginas de /panel. Arrastra las server actions: si estuviera en
// index.ts, /pos (precacheado) cargaría sus referencias aunque no las use.
export { ListaClientes, NuevoCliente } from "./components/clientes-panel";
export { listarClientes } from "./lecturas-panel";
export { leerFiltrosClientes, PAGINA_CLIENTES } from "./schemas";
