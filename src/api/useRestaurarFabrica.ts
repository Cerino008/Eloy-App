import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './cliente';

// Restaurar borra todo lo de Eloy: todas las pantallas tienen que volver a pedir sus datos.
export function useRestaurarFabrica() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.restaurarFabrica,
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
