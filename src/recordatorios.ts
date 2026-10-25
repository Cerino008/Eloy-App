// Cuándo suena cada recordatorio, en palabras y en fechas.
import type { DiaSemana, Recordatorio } from '@/api/tipos';
import { aFechaTexto, fechaLocal, nombreDeFecha } from '@/fechas';
import { capitalizar, enumerar } from '@/textos';

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

// "Todos los días", "Lunes y jueves", "De lunes a viernes", "Viernes 23 · una sola vez".
export function cuandoSuena(recordatorio: Recordatorio, ahora: Date = new Date()): string {
  switch (recordatorio.repeticion) {
    case 'diaria':
      return 'Todos los días';
    case 'semanal': {
      const dias = DIAS_SEMANA.filter((dia) => recordatorio.diasSemana.includes(dia));
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

// Si suena ese día (sin mirar la hora).
export function suenaElDia(
  recordatorio: Pick<Recordatorio, 'repeticion' | 'diasSemana' | 'fechaUnica'>,
  fecha: Date,
): boolean {
  switch (recordatorio.repeticion) {
    case 'diaria':
      return true;
    case 'semanal':
      return recordatorio.diasSemana.includes(diaSemanaDe(fecha));
    case 'una_vez':
      return recordatorio.fechaUnica === aFechaTexto(fecha);
  }
}
