// Los tokens de la sesión, guardados en el llavero del teléfono (expo-secure-store): así no hay que
// volver a entrar cada vez que se abre la app. Los usan http.ts (los manda y los renueva) y
// sesion.tsx (entrar y salir).
import * as SecureStore from 'expo-secure-store';

import type { Tokens } from './tipos';

const CLAVE = 'eloy.sesion';

export type SesionGuardada = {
  accessToken: string;
  refreshToken: string;
  venceEn: number; // cuándo vence el access token, en milisegundos
};

export async function leerSesion(): Promise<SesionGuardada | null> {
  try {
    const guardada = await SecureStore.getItemAsync(CLAVE);
    return guardada ? (JSON.parse(guardada) as SesionGuardada) : null;
  } catch {
    // Si no se puede leer, mejor pedir que entre de nuevo que dejar la app trabada.
    return null;
  }
}

export async function guardarSesion(tokens: Tokens): Promise<void> {
  const sesion: SesionGuardada = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    venceEn: Date.now() + tokens.expiraEnSeg * 1000,
  };
  await SecureStore.setItemAsync(CLAVE, JSON.stringify(sesion));
}

export async function borrarSesion(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CLAVE);
  } catch {
    // Si no se pudo borrar, la próxima vez que se abra la app se intenta de nuevo con el mismo token.
  }
}

// Cuando el refresh ya no sirve, http.ts borra la sesión y avisa: SesionProvider vuelve al login.
type AlVencer = () => void;
const alVencer = new Set<AlVencer>();

export function escucharSesionVencida(hacer: AlVencer): () => void {
  alVencer.add(hacer);
  return () => {
    alVencer.delete(hacer);
  };
}

export function avisarSesionVencida(): void {
  alVencer.forEach((hacer) => hacer());
}
