// La sesión: los tokens quedan guardados en el llavero del teléfono (expo-secure-store),
// así no hay que volver a entrar cada vez que se abre la app.
import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { api } from '@/api/cliente';
import type { Tokens } from '@/api/tipos';

const CLAVE = 'eloy.sesion';

type SesionGuardada = {
  accessToken: string;
  refreshToken: string;
  venceEn: number; // cuándo vence el access token, en milisegundos
};

async function leerSesion(): Promise<SesionGuardada | null> {
  try {
    const guardada = await SecureStore.getItemAsync(CLAVE);
    return guardada ? (JSON.parse(guardada) as SesionGuardada) : null;
  } catch {
    // Si no se puede leer, mejor pedir que entre de nuevo que dejar la app trabada.
    return null;
  }
}

async function guardarSesion(tokens: Tokens): Promise<void> {
  const sesion: SesionGuardada = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    venceEn: Date.now() + tokens.expiraEnSeg * 1000,
  };
  await SecureStore.setItemAsync(CLAVE, JSON.stringify(sesion));
}

async function borrarSesion(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CLAVE);
  } catch {
    // Si no se pudo borrar, la próxima vez que se abra la app se intenta de nuevo con el mismo token.
  }
}

// El token para el header Authorization. Lo va a usar cliente.ts al conectar el backend.
export async function tokenDeAcceso(): Promise<string | null> {
  const sesion = await leerSesion();
  if (!sesion) return null;
  // Acá va la renovación, cuando conectemos el backend real: si venceEn ya pasó (o una llamada
  // respondió 401), POST /auth/refresh con sesion.refreshToken y guardar el par nuevo (el refresh
  // rota: el viejo deja de servir). Si el refresh responde 401, la sesión venció: hay que avisarle
  // al SesionProvider para que cierre la sesión y vuelva al login.
  return sesion.accessToken;
}

type EstadoSesion = 'cargando' | 'sin_sesion' | 'con_sesion';

type ValorSesion = {
  estado: EstadoSesion;
  // Después del login o del registro, con los tokens que devolvió la API.
  entrar: (tokens: Tokens) => Promise<void>;
  salir: () => Promise<void>;
};

const ContextoSesion = createContext<ValorSesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoSesion>('cargando');

  useEffect(() => {
    leerSesion().then((sesion) => setEstado(sesion ? 'con_sesion' : 'sin_sesion'));
  }, []);

  const entrar = async (tokens: Tokens) => {
    await guardarSesion(tokens);
    // Que no quede nada de una cuenta anterior.
    queryClient.clear();
    setEstado('con_sesion');
  };

  const salir = async () => {
    // Si falla (sin internet), igual se sale: el token vence solo.
    await api.logout().catch(() => undefined);
    await borrarSesion();
    setEstado('sin_sesion');
    queryClient.clear();
  };

  return <ContextoSesion.Provider value={{ estado, entrar, salir }}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error('useSesion tiene que usarse dentro de SesionProvider');
  return valor;
}
