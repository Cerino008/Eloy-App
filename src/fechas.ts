// La API manda fechas en UTC; acá se pasan a la hora local del teléfono para mostrarlas.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function inicioDelDia(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

// "a las 10:42", "a la 1:05".
function aLaHora(fecha: Date): string {
  const horas = fecha.getHours();
  const minutos = String(fecha.getMinutes()).padStart(2, '0');
  return `${horas === 1 ? 'a la' : 'a las'} ${horas}:${minutos}`;
}

// "hoy a las 10:42", "ayer a las 18:30", "el martes a las 9:00", "el 3/10 a las 9:00".
export function cuandoFue(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso);
  // Math.round por los días de 23 o 25 horas cuando cambia el horario.
  const dias = Math.round((inicioDelDia(ahora) - inicioDelDia(fecha)) / MS_POR_DIA);

  if (dias <= 0) return `hoy ${aLaHora(fecha)}`;
  if (dias === 1) return `ayer ${aLaHora(fecha)}`;
  if (dias < 7) return `el ${DIAS[fecha.getDay()]} ${aLaHora(fecha)}`;
  return `el ${fecha.getDate()}/${fecha.getMonth() + 1} ${aLaHora(fecha)}`;
}
