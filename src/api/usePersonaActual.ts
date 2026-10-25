import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';

import { consultas } from './consultas';
import type { PersonaResumen } from './tipos';

// La persona que muestra la app: por ahora, la primera que sigo. Las pantallas que la usan solo se
// abren con personas cargadas (lo asegura el flujo de entrada en app/_layout.tsx).
export function usePersonaActual(): PersonaResumen {
  const persona = useQuery(consultas.personas).data?.[0];
  // Al cerrar sesión se borra la caché un instante antes de que se cierre la pantalla: se sigue con la última.
  const ultima = useRef(persona);
  if (persona) ultima.current = persona;
  if (!ultima.current) throw new Error('usePersonaActual: se usó en una pantalla que se abre sin personas');
  return ultima.current;
}
