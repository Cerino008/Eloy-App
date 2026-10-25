import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './cliente';
import { consultas } from './consultas';

// Al sumarme a una familia cambian las personas que sigo: el flujo de entrada lleva solo a las pestañas.
export function useAceptarInvitacion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.aceptarInvitacion,
    onSuccess: () =>
      Promise.all(
        [consultas.personas, consultas.yo].map(({ queryKey }) => queryClient.invalidateQueries({ queryKey })),
      ),
  });
}
