// RN-04: un registro sin conexión lo puede enviar otra persona distinta de la que lo registró.
// null si no hay nada que avisar (misma persona, o no se sabe quién envió). Devuelve la etiqueta completa.
export function textoEnviadaPor(
  registradoId: string | null,
  enviadaId: string | null,
  nombreEnviada: string | null,
): string | null {
  if (!enviadaId || enviadaId === registradoId) return null;
  return `Sin conexión, enviada por ${nombreEnviada ?? "otra persona"}`;
}
