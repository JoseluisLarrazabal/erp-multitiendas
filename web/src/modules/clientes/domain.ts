// `telefono` solo viene de la búsqueda: la boleta de lavandería lo imprime si está.
export type ClienteElegido = {
  id: string;
  nombre: string;
  documento: string | null;
  telefono?: string | null;
};

// Quita lo que rompería el filtro `or(...)` de PostgREST y los comodines de ilike.
export const limpiarBusqueda = (q: string) =>
  q
    .replace(/[,()%*_\\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// El servidor guarda el documento en mayúsculas y sin espacios: la búsqueda y el aviso de duplicado usan lo mismo.
export const normalizarDocumento = (doc: string) => doc.toUpperCase().replace(/\s/g, "");
