// Cuándo suena cada recordatorio, en palabras y en fechas.
import type { DiaSemana, Recordatorio } from '@/api/tipos';
import { aFechaTexto, fechaLocal, nombreDeFecha } from '@/fechas';

// La semana empieza el lunes.
export const DIAS_SEMANA: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

export const NOMBRE_DIA: Record<DiaSemana, string> = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miércoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sábado',
  domingo: 'domingo',
};

// En el orden de Date.getDay(), que arranca el domingo.
const POR_GET_DAY: DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

export function diaSemanaDe(fecha: Date): DiaSemana {
  return POR_GET_DAY[fecha.getDay()];
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "lunes", "lunes y jueves", "lunes, miércoles y viernes".
function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

// "Todos los días", "Lunes y jueves", "De lunes a viernes", "Viernes 23 · una sola vez".
export function cuandoSuena(recordatorio: Recordatorio, ahora: Date = new Date()): string {
  switch (recordatorio.repeticion) {
    case 'diaria':
      return 'Todos los días';
    case 'semanal': {
      const dias = DIAS_SEMANA.filter((dia) => recordatorio.diasSemana?.includes(dia));
      if (dias.length === 7) return 'Todos los días';
      if (dias.length === 5 && !dias.includes('sabado') && !dias.includes('domingo')) return 'De lunes a viernes';
      return capitalizar(enumerar(dias.map((dia) => NOMBRE_DIA[dia])));
    }
    case 'una_vez':
      return recordatorio.fechaUnica
        ? `${nombreDeFecha(fechaLocal(recordatorio.fechaUnica), ahora)} · una sola vez`
        : 'Una sola vez';
  }
}

export function suenaElDia(recordatorio: Recordatorio, fecha: Date): boolean {
  switch (recordatorio.repeticion) {
    case 'diaria':
      return true;
    case 'semanal':
      return recordatorio.diasSemana?.includes(diaSemanaDe(fecha)) ?? false;
    case 'una_vez':
      return recordatorio.fechaUnica === aFechaTexto(fecha);
  }
}

// La próxima vez que va a sonar, desde ahora. null si ya no vuelve a sonar.
export function proximaVez(recordatorio: Recordatorio, ahora: Date = new Date()): Date | null {
  const [horas, minutos] = recordatorio.hora.split(':').map(Number);

  if (recordatorio.repeticion === 'una_vez') {
    if (!recordatorio.fechaUnica) return null;
    const fecha = fechaLocal(recordatorio.fechaUnica);
    fecha.setHours(horas, minutos, 0, 0);
    return fecha >= ahora ? fecha : null;
  }

  // En 8 días seguro aparece cualquier día de la semana, incluso hoy si ya pasó la hora.
  for (let i = 0; i <= 7; i++) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i, horas, minutos);
    if (fecha >= ahora && suenaElDia(recordatorio, fecha)) return fecha;
  }
  return null;
}
