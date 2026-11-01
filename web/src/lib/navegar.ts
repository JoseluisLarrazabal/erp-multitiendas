// Navegación completa (no soft): necesaria entre /pos, /login y /panel por el alcance del service worker.
export function navegarA(ruta: string) {
  window.location.assign(ruta);
}
