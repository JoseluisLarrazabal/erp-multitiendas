// Entrada pública sin server actions. Las páginas de /panel usan ./panel.
export * from "./domain";
export {
  DIAS_VENCIMIENTO,
  filtrosKardexSchema,
  filtrosStockSchema,
  leerFiltrosVencimientos,
  type FiltrosStock,
} from "./schemas";
