// Consultas de React Query: la clave y la función de cada dato, en un solo lugar.
import { queryOptions } from '@tanstack/react-query';

import { api } from './cliente';

export const consultas = {
  yo: queryOptions({ queryKey: ['yo'], queryFn: api.yo }),
  hoy: queryOptions({ queryKey: ['hoy'], queryFn: api.hoy }),
  mensajes: queryOptions({ queryKey: ['mensajes'], queryFn: api.mensajes }),
};
