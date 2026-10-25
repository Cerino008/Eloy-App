import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './cliente';
import { consultas, deTodasLasPersonas } from './consultas';

// "Ya me ocupo yo". Salga bien o mal (por ejemplo, el 409 si otro ya la tomó), se vuelven a pedir
// la alerta y Inicio, para que el cartel rojo y quién se ocupa queden al día.
export function useAtenderAlerta(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.atenderAlerta(id),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: consultas.alerta(id).queryKey }),
        queryClient.invalidateQueries({ queryKey: deTodasLasPersonas.inicio }),
      ]),
  });
}
