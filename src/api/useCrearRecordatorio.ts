import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './cliente';
import { consultas } from './consultas';
import type { RecordatorioNuevo } from './tipos';

// Crea un recordatorio y actualiza la lista y el "próximo recordatorio" de Inicio.
// Devolver la promesa hace que la mutación termine recién cuando las dos están al día.
export function useCrearRecordatorio(idPersona: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: RecordatorioNuevo) => api.crearRecordatorio(idPersona, datos),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: consultas.recordatorios(idPersona).queryKey }),
        queryClient.invalidateQueries({ queryKey: consultas.inicio(idPersona).queryKey }),
      ]),
  });
}
