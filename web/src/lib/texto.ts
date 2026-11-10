// Quita tildes y diéresis (la ñ también pierde la tilde): la base compara contra `busqueda`, calculado con sin_tildes.
export const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");
