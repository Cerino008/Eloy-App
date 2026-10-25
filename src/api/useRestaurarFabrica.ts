import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './cliente';
import { consultas } from './consultas';

// Responde 202: Eloy se restaura en su próxima sincronización. Se recarga la familia para que el
// dispositivo aparezca como "restaurando".
export function useRestaurarFabrica(idPersona: number, idDispositivo: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.restaurarFabrica(idDispositivo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: consultas.familia(idPersona).queryKey }),
  });
}
