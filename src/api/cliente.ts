// Todas las llamadas a la API pasan por acá. Hoy devuelven los datos de ejemplo;
// cuando el backend esté listo, solo cambia este archivo.
import * as ejemplo from './ejemplo';
import type { Familiar, Hoy, Mensaje } from './tipos';

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

// Hace de base de datos: lo que se manda queda acá hasta que se recarga la app.
const mensajes: Mensaje[] = [...ejemplo.mensajes];

export const api = {
  // Quién usa la app. No está en el contrato todavía: acordarlo con Héctor.
  yo: (): Promise<Familiar> => simularServidor(() => ejemplo.yo),
  hoy: (): Promise<Hoy> => simularServidor(() => ejemplo.hoy),

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
};
