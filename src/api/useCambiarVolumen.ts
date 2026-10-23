import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './cliente';
import { consultas } from './consultas';

// Cambia el volumen y lo muestra al instante. Si falla, vuelve al valor anterior y avisa con `alFallar`.
export function useCambiarVolumen(alFallar: () => void) {
  const queryClient = useQueryClient();
  const clave = consultas.dispositivo.queryKey;

  return useMutation({
    mutationFn: api.cambiarVolumen,
    onMutate: async (volumen) => {
      await queryClient.cancelQueries({ queryKey: clave });
      const anterior = queryClient.getQueryData(clave);
      queryClient.setQueryData(clave, (actual) => (actual ? { ...actual, volumen } : actual));
      return { anterior };
    },
    onError: (_error, _volumen, resultado) => {
      queryClient.setQueryData(clave, resultado?.anterior);
      alFallar();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: clave }),
  });
}
