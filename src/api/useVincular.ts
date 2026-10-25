import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './cliente';
import { consultas } from './consultas';

// Con un Eloy nuevo cambian las personas que sigo, la familia, el dispositivo y el inicio.
// Espera a que se recarguen: así, al terminar, el flujo de entrada ya sabe que hay personas.
export function useVincular() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.vincular,
    onSuccess: () =>
      Promise.all(
        [consultas.personas, consultas.yo, consultas.hoy, consultas.familiares, consultas.dispositivo].map(
          ({ queryKey }) => queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
