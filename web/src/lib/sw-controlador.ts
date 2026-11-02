type Contenedor = Pick<
  ServiceWorkerContainer,
  "controller" | "addEventListener" | "removeEventListener"
>;

// Avisa cuando un service worker NUEVO toma el control de la página. El primer `controllerchange` de una página sin
// controlador es la instalación inicial (clientsClaim), no una actualización: se descarta, pero desde ahí la página ya
// tiene controlador. Sin esto una pestaña abierta antes de que el SW existiera ignoraría para siempre las actualizaciones.
// `propio` indica que ESTA pestaña pidió la actualización: entonces cualquier cambio vale, porque con recarga forzada
// (Shift+Reload) `controller` es null aunque haya un SW activo y descartar ese cambio dejaría la espera colgada.
export function alCambiarControlador(
  sw: Contenedor,
  alActualizar: () => void,
  propio: () => boolean = () => false,
): () => void {
  let habiaControlador = !!sw.controller;
  const alCambiar = () => {
    if (!habiaControlador && !propio()) {
      habiaControlador = true;
      return;
    }
    alActualizar();
  };
  sw.addEventListener("controllerchange", alCambiar);
  return () => sw.removeEventListener("controllerchange", alCambiar);
}
