import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './cliente';
import { consultas } from './consultas';
import type { Mensaje } from './tipos';

// Manda un mensaje y lo muestra al instante, sin esperar al servidor.
// Si falla, la lista vuelve a como estaba y `alFallar` recibe el texto para no perderlo.
export function useEnviarMensaje(alFallar: (texto: string) => void) {
  const queryClient = useQueryClient();
  const clave = consultas.mensajes.queryKey;

  return useMutation({
    mutationFn: api.enviarMensaje,
    onMutate: async (texto) => {
      // Que una carga en curso no pise el mensaje provisorio.
      await queryClient.cancelQueries({ queryKey: clave });
      const anteriores = queryClient.getQueryData(clave);
      const yo = queryClient.getQueryData(consultas.yo.queryKey);

      const provisorio: Mensaje = {
        id: -Date.now(), // negativo: nunca choca con un id del servidor
        direccion: 'de_familia',
        de: yo?.nombre ?? '',
        deFamiliarId: yo?.id ?? null,
        para: null,
        texto,
        audioUrl: null,
        audioDuracionSeg: null,
        estado: 'pendiente',
        leidoEn: null,
        creadoEn: new Date().toISOString(),
      };
      queryClient.setQueryData(clave, (lista = []) => [...lista, provisorio]);

      return { anteriores };
    },
    onError: (_error, texto, resultado) => {
      queryClient.setQueryData(clave, resultado?.anteriores);
      alFallar(texto);
    },
    // Salga bien o mal, se vuelve a pedir la lista para quedar igual que el servidor.
    onSettled: () => queryClient.invalidateQueries({ queryKey: clave }),
  });
}
