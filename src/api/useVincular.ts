import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './cliente';
import { consultas } from './consultas';

// Con un Eloy nuevo cambian las personas que sigo, la familia (con el dispositivo) y el inicio.
// Espera a que se recarguen: así, al terminar, el flujo de entrada ya sabe que hay personas.
export function useVincular() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.vincular,
    onSuccess: ({ idPersona }) =>
      Promise.all(
        [consultas.personas, consultas.inicio(idPersona), consultas.familia(idPersona)].map(({ queryKey }) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
