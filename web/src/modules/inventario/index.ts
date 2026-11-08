// Entrada pública. Las páginas de /panel usan ./panel (queries y formularios de servidor). Aquí salen también los
// campos de cliente que reutilizan otros módulos (compras); /pos no importa este módulo.
export { PieOperacion } from "./components/pie-operacion";
export { SelectorProducto } from "./components/selector-producto";
export { SelectUbicacion } from "./components/select-ubicacion";
export { useOperacion } from "./components/use-operacion";
export * from "./domain";
export {
  DIAS_VENCIMIENTO,
  filtrosKardexSchema,
  filtrosStockSchema,
  leerFiltrosVencimientos,
  type FiltrosStock,
} from "./schemas";
