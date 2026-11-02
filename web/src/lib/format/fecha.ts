// Fechas en hora de Bolivia (UTC-4, sin horario de verano), sin depender de la zona del servidor o del navegador.
const PARTES = new Intl.DateTimeFormat("es-BO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/La_Paz",
});

function partes(iso: string) {
  return Object.fromEntries(PARTES.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
}

// dd/mm/aaaa hh:mm
export function formatearFechaHora(iso: string): string {
  const p = partes(iso);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

// hh:mm
export function formatearHora(iso: string): string {
  const p = partes(iso);
  return `${p.hour}:${p.minute}`;
}

// "2026-11-01" -> instante de inicio de ese día en Bolivia, y el del día siguiente (rango [inicio, fin)).
// null si no es una fecha de calendario válida.
export function limitesDelDia(dia: string): { inicio: string; fin: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const inicio = new Date(`${dia}T00:00:00-04:00`);
  if (Number.isNaN(inicio.getTime())) return null;
  // Rechaza 2026-02-31: el instante debe volver al mismo día calendario en Bolivia.
  const vuelta = new Date(inicio.getTime() - 4 * 3600_000).toISOString().slice(0, 10);
  if (vuelta !== dia) return null;
  return {
    inicio: inicio.toISOString(),
    fin: new Date(inicio.getTime() + 86_400_000).toISOString(),
  };
}

// "hace un momento", "hace 5 min", "hace 3 h", "hace 2 días". Para la edad de datos guardados.
export function formatearHace(desdeMs: number, ahoraMs: number = Date.now()): string {
  const min = Math.max(0, Math.floor((ahoraMs - desdeMs) / 60_000));
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}
