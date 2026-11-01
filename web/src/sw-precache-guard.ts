// Serwist copia las respuestas redirigidas y las guarda bajo la URL pedida: un redirect a /login
// quedaría precacheado como /pos sin error. Este plugin hace fallar la instalación; se reintenta
// en la próxima carga. Reemplaza al plugin por defecto, así que también rechaza respuestas no-ok.
export const precacheGuardPlugin = {
  async cacheWillUpdate({ request, response }: { request: Request; response: Response }) {
    if (response.redirected || !response.ok || (response.url && response.url !== request.url)) {
      throw new Error(`Precache rechazado para ${request.url}: ${response.status} ${response.url}`);
    }
    return response;
  },
};
