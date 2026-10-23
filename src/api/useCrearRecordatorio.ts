import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './cliente';
import { consultas } from './consultas';

// Crea un recordatorio y actualiza la lista y el "próximo recordatorio" de Inicio.
// Devolver la promesa hace que la mutación termine recién cuando las dos están al día.
export function useCrearRecordatorio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.crearRecordatorio,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: consultas.recordatorios.queryKey }),
        queryClient.invalidateQueries({ queryKey: consultas.hoy.queryKey }),
      ]),
  });
}
