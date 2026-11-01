// Lo que solo corre en servidor (cookies, redirect). Lo importan páginas de servidor que no son del panel
// (portada, sin-acceso) por esta entrada: /pos y los módulos de cliente nunca la importan.
export { obtenerContexto, type Contexto } from "./contexto";
