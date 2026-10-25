// Consultas de React Query: la clave y la función de cada dato, en un solo lugar.
import { queryOptions } from '@tanstack/react-query';

import { api } from './cliente';

export const consultas = {
  yo: queryOptions({ queryKey: ['yo'], queryFn: api.yo }),
  usuario: queryOptions({ queryKey: ['usuario'], queryFn: api.usuario }),
  personas: queryOptions({ queryKey: ['personas'], queryFn: api.personas }),
  hoy: queryOptions({ queryKey: ['hoy'], queryFn: api.hoy }),
  mensajes: queryOptions({ queryKey: ['mensajes'], queryFn: api.mensajes }),
  recordatorios: queryOptions({ queryKey: ['recordatorios'], queryFn: api.recordatorios }),
  familiares: queryOptions({ queryKey: ['familiares'], queryFn: api.familiares }),
  dispositivo: queryOptions({ queryKey: ['dispositivo'], queryFn: api.dispositivo }),
  alerta: (id: number) => queryOptions({ queryKey: ['alerta', id], queryFn: () => api.alerta(id) }),
};
