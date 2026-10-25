// Consultas de React Query: la clave y la función de cada dato, en un solo lugar.
// Las de una persona llevan su id en la clave: si después se puede cambiar de persona, no se mezclan.
import { queryOptions } from '@tanstack/react-query';

import { api } from './cliente';

export const consultas = {
  usuario: queryOptions({ queryKey: ['usuario'], queryFn: api.usuario }),
  personas: queryOptions({ queryKey: ['personas'], queryFn: api.personas }),
  inicio: (idPersona: number) => queryOptions({ queryKey: ['inicio', idPersona], queryFn: () => api.inicio(idPersona) }),
  mensajes: (idPersona: number) =>
    queryOptions({ queryKey: ['mensajes', idPersona], queryFn: () => api.mensajes(idPersona) }),
  recordatorios: (idPersona: number) =>
    queryOptions({ queryKey: ['recordatorios', idPersona], queryFn: () => api.recordatorios(idPersona) }),
  familia: (idPersona: number) =>
    queryOptions({ queryKey: ['familia', idPersona], queryFn: () => api.familia(idPersona) }),
  alerta: (id: number) => queryOptions({ queryKey: ['alerta', id], queryFn: () => api.alerta(id) }),
};

// Para invalidar una consulta de todas las personas a la vez (ej. Inicio, al atender una alerta).
export const deTodasLasPersonas = {
  inicio: ['inicio'],
};
