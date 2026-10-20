// Todas las llamadas a la API pasan por acá. Hoy devuelven los datos de ejemplo;
// cuando el backend esté listo, solo cambia este archivo.
import * as ejemplo from './ejemplo';
import type { Familiar, Hoy } from './tipos';

const DEMORA_MS = 700;

// Simula ir al servidor: tarda un poco y devuelve una copia, como un JSON nuevo.
function simularServidor<T>(datos: T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (ejemplo.escenario.fallar) reject(new Error('No se pudo conectar con el servidor'));
      else resolve(JSON.parse(JSON.stringify(datos)) as T);
    }, DEMORA_MS);
  });
}

export const api = {
  // Quién usa la app. No está en el contrato todavía: acordarlo con Héctor.
  yo: (): Promise<Familiar> => simularServidor(ejemplo.yo),
  hoy: (): Promise<Hoy> => simularServidor(ejemplo.hoy),
};
