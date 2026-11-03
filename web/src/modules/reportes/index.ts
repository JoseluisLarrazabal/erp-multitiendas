// Entrada pública sin server actions ni lecturas del servidor. Las páginas de /panel usan ./panel.
export * from "./domain";
export { nombreArchivo, slug } from "./excel";
export { hrefReportes, leerFiltrosReporte, rangosRapidos, type FiltrosReporte } from "./schemas";
export { armarTabla, textoCelda, type TablaDatos } from "./tabla";
