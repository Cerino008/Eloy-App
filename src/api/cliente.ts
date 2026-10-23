// Todas las llamadas a la API pasan por acá. Hoy devuelven los datos de ejemplo;
// cuando el backend esté listo, solo cambia este archivo.
import { aHoraTexto } from '@/fechas';
import { suenaElDia } from '@/recordatorios';

import * as ejemplo from './ejemplo';
import type { Familiar, Hoy, Mensaje, Recordatorio, RecordatorioNuevo } from './tipos';

const DEMORA_MS = 700;

// Simula ir al servidor: tarda un poco y devuelve una copia, como un JSON nuevo.
function simularServidor<T>(datos: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (ejemplo.escenario.fallar) reject(new Error('No se pudo conectar con el servidor'));
      else resolve(JSON.parse(JSON.stringify(datos())) as T);
    }, DEMORA_MS);
  });
}

// Hacen de base de datos: lo que se manda queda acá hasta que se recarga la app.
const mensajes: Mensaje[] = [...ejemplo.mensajes];
const recordatorios: Recordatorio[] = [...ejemplo.recordatorios];

// Lo que va a calcular el servidor: si suena hoy y, en ese caso, si ya sonó.
function conEstadoDeHoy(recordatorio: Recordatorio, ahora: Date): Recordatorio {
  if (!suenaElDia(recordatorio, ahora)) return { ...recordatorio, estadoHoy: undefined };
  return { ...recordatorio, estadoHoy: recordatorio.hora <= aHoraTexto(ahora) ? 'sono' : 'pendiente' };
}

function recordatoriosDeHoy(ahora: Date): Recordatorio[] {
  return recordatorios
    .map((recordatorio) => conEstadoDeHoy(recordatorio, ahora))
    .filter((recordatorio) => recordatorio.estadoHoy !== undefined)
    .sort((a, b) => a.hora.localeCompare(b.hora));
}

export const api = {
  // Quién usa la app. No está en el contrato todavía: acordarlo con Héctor.
  yo: (): Promise<Familiar> => simularServidor(() => ejemplo.yo),

  hoy: (): Promise<Hoy> =>
    simularServidor(() => {
      const deHoy = recordatoriosDeHoy(new Date());
      const siguiente = deHoy.find((recordatorio) => recordatorio.estadoHoy === 'pendiente');
      return {
        ...ejemplo.hoy,
        recordatorios: {
          cumplidos: deHoy.filter((recordatorio) => recordatorio.estadoHoy === 'sono').length,
          total: deHoy.length,
        },
        proximo: siguiente ? { hora: siguiente.hora, titulo: siguiente.titulo } : null,
      };
    }),

  // Del más viejo al más nuevo.
  mensajes: (): Promise<Mensaje[]> =>
    simularServidor(() => [...mensajes].sort((a, b) => Date.parse(a.creadoEn) - Date.parse(b.creadoEn))),

  enviarMensaje: (texto: string): Promise<Mensaje> =>
    simularServidor(() => {
      const nuevo: Mensaje = {
        id: Math.max(0, ...mensajes.map((m) => m.id)) + 1,
        direccion: 'de_familia',
        de: ejemplo.yo.nombre,
        deFamiliarId: ejemplo.yo.id,
        para: null,
        texto,
        audioUrl: null,
        audioDuracionSeg: null,
        estado: 'pendiente',
        leidoEn: null,
        creadoEn: new Date().toISOString(),
      };
      mensajes.push(nuevo);
      return nuevo;
    }),

  // Ordenados por hora; los que suenan hoy traen estadoHoy.
  recordatorios: (): Promise<Recordatorio[]> =>
    simularServidor(() => {
      const ahora = new Date();
      return recordatorios
        .map((recordatorio) => conEstadoDeHoy(recordatorio, ahora))
        .sort((a, b) => a.hora.localeCompare(b.hora));
    }),

  crearRecordatorio: (datos: RecordatorioNuevo): Promise<Recordatorio> =>
    simularServidor(() => {
      const nuevo: Recordatorio = { id: Math.max(0, ...recordatorios.map((r) => r.id)) + 1, ...datos };
      recordatorios.push(nuevo);
      return conEstadoDeHoy(nuevo, new Date());
    }),
};
