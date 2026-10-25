// Códigos de vinculación (los que muestra Eloy) y de invitación (los que viajan en un link).

// El mismo alfabeto del backend (seguridad.py): sin 0, O, 1, I ni L, para que no se confundan.
export const ALFABETO_VINCULACION = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const LARGO_VINCULACION = 6;

// El backend no acepta códigos de invitación más cortos.
export const LARGO_MINIMO_INVITACION = 10;

// Si es un link con ?codigo=, el código; si no, el texto tal cual (sin espacios alrededor).
// Sirve para el QR de Eloy y para la invitación pegada.
export function codigoDeTexto(texto: string): string {
  const limpio = texto.trim();
  const enLink = /[?&]codigo=([^&#\s]+)/i.exec(limpio);
  if (!enLink) return limpio;
  try {
    return decodeURIComponent(enLink[1]);
  } catch {
    return enLink[1];
  }
}

// Mientras se escribe: mayúsculas y solo lo que puede tener un código de Eloy, hasta 6.
export function limpiarCodigoVinculacion(texto: string): string {
  return [...texto.toUpperCase()]
    .filter((letra) => ALFABETO_VINCULACION.includes(letra))
    .join('')
    .slice(0, LARGO_VINCULACION);
}

export function esCodigoVinculacion(texto: string): boolean {
  return texto.length === LARGO_VINCULACION && limpiarCodigoVinculacion(texto) === texto;
}
