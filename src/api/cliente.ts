// Todas las llamadas a la API pasan por acá. Hoy devuelven los datos de ejemplo;
// cuando el backend esté listo, solo cambia este archivo.
import { aHoraTexto } from '@/fechas';
import { suenaElDia } from '@/recordatorios';

import * as ejemplo from './ejemplo';
import type {
  Dispositivo,
  Familiar,
  Hoy,
  Invitacion,
  Mensaje,
  Recordatorio,
  RecordatorioNuevo,
} from './tipos';

const DEMORA_MS = 700;

// Simula ir al servidor: tarda un poco y devuelve una copia, como un JSON nuevo.
// Si `datos` tira un error, la promesa falla, como una respuesta de error del servidor.
function simularServidor<T>(datos: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        if (ejemplo.escenario.fallar) throw new Error('No se pudo conectar con el servidor');
        const resultado = datos();
        resolve(resultado === undefined ? resultado : (JSON.parse(JSON.stringify(resultado)) as T));
      } catch (error) {
        reject(error);
      }
    }, DEMORA_MS);
  });
}

// Hacen de base de datos: lo que se manda queda acá hasta que se recarga la app.
const mensajes: Mensaje[] = [...ejemplo.mensajes];
const recordatorios: Recordatorio[] = [...ejemplo.recordatorios];
const familiares: Familiar[] = [...ejemplo.familiares];
let dispositivo: Dispositivo | null = ejemplo.escenario.sinDispositivo ? null : { ...ejemplo.dispositivo };

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

// Sin 0/O ni 1/I, para que no se confundan al dictarlo.
const LETRAS_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function codigoNuevo(): string {
  return Array.from({ length: 6 }, () => LETRAS_CODIGO[Math.floor(Math.random() * LETRAS_CODIGO.length)]).join('');
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

  familiares: (): Promise<Familiar[]> => simularServidor(() => familiares),

  // null: todavía no hay un Eloy vinculado.
  dispositivo: (): Promise<Dispositivo | null> => simularServidor(() => dispositivo),

  // Pendiente con Héctor.
  cambiarVolumen: (volumen: number): Promise<Dispositivo> =>
    simularServidor(() => {
      if (!dispositivo) throw new Error('No hay un Eloy vinculado');
      dispositivo = { ...dispositivo, volumen: Math.min(100, Math.max(0, Math.round(volumen))) };
      return dispositivo;
    }),

  // Pendiente con Héctor.
  invitarFamiliar: (): Promise<Invitacion> => simularServidor(() => ({ codigo: codigoNuevo() })),

  // Pendiente con Héctor. Simula el borrado: sin Eloy, sin charlas, sin recordatorios y la familia solo con quien lo pidió.
  restaurarFabrica: (): Promise<void> =>
    simularServidor(() => {
      dispositivo = null;
      mensajes.length = 0;
      recordatorios.length = 0;
      familiares.splice(0, familiares.length, ejemplo.yo);
    }),
};
