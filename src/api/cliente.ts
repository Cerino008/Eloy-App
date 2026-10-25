// Todas las llamadas a la API pasan por acá. Hoy devuelven los datos de ejemplo;
// cuando el backend esté listo, solo cambia este archivo.
import { aHoraTexto } from '@/fechas';
import { suenaElDia } from '@/recordatorios';

import { ErrorApi } from './errores';
import * as ejemplo from './ejemplo';
import type {
  Alerta,
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
let alerta: Alerta | null = ejemplo.escenario.alertaAbierta ? { ...ejemplo.alerta } : null;

function buscarAlerta(id: number): Alerta {
  if (!alerta || alerta.id !== id) throw new ErrorApi(404, 'Alerta no encontrada');
  return alerta;
}

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
  // Quién usa la app. En el backend: GET /auth/yo, y el rol sale de GET /personas/{id}/familia.
  yo: (): Promise<Familiar> => simularServidor(() => ejemplo.yo),

  hoy: (): Promise<Hoy> =>
    simularServidor(() => {
      const deHoy = recordatoriosDeHoy(new Date());
      const siguiente = deHoy.find((recordatorio) => recordatorio.estadoHoy === 'pendiente');
      // Como el backend: el estado es "alerta" mientras haya una alerta abierta, y solo entonces.
      const abierta = alerta?.estado === 'abierta' ? alerta : null;
      const estado = abierta ? 'alerta' : ejemplo.hoy.estado === 'alerta' ? 'bien' : ejemplo.hoy.estado;
      return {
        ...ejemplo.hoy,
        estado,
        alertaAbiertaId: abierta?.id ?? null,
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

  // En el backend: PATCH /dispositivos/{id}, responde 202 y Eloy lo aplica en la próxima sincronización.
  cambiarVolumen: (volumen: number): Promise<Dispositivo> =>
    simularServidor(() => {
      if (!dispositivo) throw new Error('No hay un Eloy vinculado');
      dispositivo = { ...dispositivo, volumen: Math.min(100, Math.max(0, Math.round(volumen))) };
      return dispositivo;
    }),

  // En el backend: POST /personas/{id}/invitaciones devuelve { link, codigo, expira_en }.
  invitarFamiliar: (): Promise<Invitacion> => simularServidor(() => ({ codigo: codigoNuevo() })),

  alerta: (id: number): Promise<Alerta> => simularServidor(() => buscarAlerta(id)),

  // Como POST /alertas/{id}/atender: si otro ya la tomó, 409 con quién se ocupa.
  atenderAlerta: (id: number): Promise<Alerta> =>
    simularServidor(() => {
      let actual = buscarAlerta(id);
      if (actual.estado === 'abierta' && ejemplo.escenario.atendidaPorOtro) {
        // Vero tocó "Ya me ocupo yo" un instante antes.
        actual = { ...actual, estado: 'atendida', atendidaPor: 'Vero', atendidaPorMi: false, atendidaEn: new Date().toISOString() };
        alerta = actual;
      }
      if (actual.estado !== 'abierta') {
        throw new ErrorApi(409, actual.atendidaPor ? `${actual.atendidaPor} ya se está ocupando` : 'La alerta ya no está abierta');
      }
      alerta = {
        ...actual,
        estado: 'atendida',
        atendidaPor: ejemplo.yo.nombre,
        atendidaPorMi: true,
        atendidaEn: new Date().toISOString(),
      };
      return alerta;
    }),

  // Simula el borrado: sin Eloy, sin charlas, sin recordatorios y la familia solo con quien lo pidió.
  restaurarFabrica: (): Promise<void> =>
    simularServidor(() => {
      dispositivo = null;
      mensajes.length = 0;
      recordatorios.length = 0;
      familiares.splice(0, familiares.length, ejemplo.yo);
    }),
};
