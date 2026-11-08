// Tercera entrada del módulo, solo para componentes de cliente del panel que otros módulos reutilizan (compras).
// SelectorProducto importa server actions: no va en index.ts ni se importa desde /pos. Tampoco en panel.ts, que
// reexporta lecturas de servidor y no se puede cargar desde un componente de cliente.
export { PieOperacion } from "./components/pie-operacion";
export { SelectorProducto } from "./components/selector-producto";
export { SelectUbicacion } from "./components/select-ubicacion";
export { useOperacion } from "./components/use-operacion";
