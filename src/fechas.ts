// La API manda fechas en UTC; acá se pasan a la hora local del teléfono para mostrarlas.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function inicioDelDia(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

// Días de calendario entre la fecha y hoy. Math.round por los días de 23 o 25 horas cuando cambia el horario.
function diasAtras(fecha: Date, ahora: Date): number {
  return Math.round((inicioDelDia(ahora) - inicioDelDia(fecha)) / MS_POR_DIA);
}

function horaDe(fecha: Date): string {
  return `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

// "a las 10:42", "a la 1:05".
function aLaHora(fecha: Date): string {
  return `${fecha.getHours() === 1 ? 'a la' : 'a las'} ${horaDe(fecha)}`;
}

// "11:20".
export function hora(iso: string): string {
  return horaDe(new Date(iso));
}

// Duración de un audio: 4 → "0:04", 75 → "1:15".
export function duracion(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// "Hoy", "Ayer", "Mañana", "Martes 13" (hasta una semana para cada lado), "13 de septiembre", "13 de septiembre de 2025".
export function nombreDeFecha(fecha: Date, ahora: Date = new Date()): string {
  const dias = diasAtras(fecha, ahora);

  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias === -1) return 'Mañana';
  if (Math.abs(dias) < 7) {
    const dia = DIAS[fecha.getDay()];
    return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${fecha.getDate()}`;
  }
  const diaYMes = `${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
  return fecha.getFullYear() === ahora.getFullYear() ? diaYMes : `${diaYMes} de ${fecha.getFullYear()}`;
}

// Para separar una charla por días, a partir de una fecha UTC de la API.
export function nombreDelDia(iso: string, ahora: Date = new Date()): string {
  return nombreDeFecha(new Date(iso), ahora);
}

// Fechas sin hora ("2026-10-23") y horas sueltas ("09:00"), como las usan los recordatorios.
// new Date("2026-10-23") la tomaría como medianoche UTC: en Argentina sería el día anterior.
export function fechaLocal(texto: string): Date {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

export function aFechaTexto(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function aHoraTexto(fecha: Date): string {
  return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

// "hoy a las 10:42", "ayer a las 18:30", "el martes a las 9:00", "el 3/10 a las 9:00".
export function cuandoFue(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso);
  const dias = diasAtras(fecha, ahora);

  if (dias <= 0) return `hoy ${aLaHora(fecha)}`;
  if (dias === 1) return `ayer ${aLaHora(fecha)}`;
  if (dias < 7) return `el ${DIAS[fecha.getDay()]} ${aLaHora(fecha)}`;
  return `el ${fecha.getDate()}/${fecha.getMonth() + 1} ${aLaHora(fecha)}`;
}
