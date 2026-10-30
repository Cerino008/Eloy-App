// La sesión: si hay tokens guardados en el teléfono (sesionGuardada.ts), entrar y salir. Los manda y los
// renueva http.ts; si el refresh ya no sirve, avisa y acá se vuelve al login.
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { api } from '@/api/cliente';
import { borrarSesion, escucharSesionVencida, guardarSesion, leerSesion } from '@/api/sesionGuardada';
import type { Tokens } from '@/api/tipos';

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
    // El refresh venció o lo revocaron (ej. "cerrar todas las sesiones"): http.ts ya borró los tokens.
    return escucharSesionVencida(() => {
      setEstado('sin_sesion');
      queryClient.clear();
    });
  }, [queryClient]);

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
