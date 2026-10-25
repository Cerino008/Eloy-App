import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './cliente';
import { consultas } from './consultas';
import type { Mensaje } from './tipos';

// Manda un mensaje y lo muestra al instante, sin esperar al servidor.
// Si falla, la lista vuelve a como estaba y `alFallar` recibe el texto para no perderlo.
export function useEnviarMensaje(idPersona: number, alFallar: (texto: string) => void) {
  const queryClient = useQueryClient();
  const clave = consultas.mensajes(idPersona).queryKey;

  return useMutation({
    mutationFn: (texto: string) => api.enviarMensaje(idPersona, texto),
    onMutate: async (texto) => {
      // Que una carga en curso no pise el mensaje provisorio.
      await queryClient.cancelQueries({ queryKey: clave });
      const anteriores = queryClient.getQueryData(clave);

      const provisorio: Mensaje = {
        id: -Date.now(), // negativo: nunca choca con un id del servidor
        direccion: 'de_familia',
        de: queryClient.getQueryData(consultas.usuario.queryKey)?.nombre ?? null,
        para: null,
        esMio: true,
        texto,
        audioUrl: null,
        audioDuracionSeg: null,
        estado: 'pendiente',
        entregadoEn: null,
        leidoEn: null,
        creadoEn: new Date().toISOString(),
      };
      // La lista va de los más nuevos a los más viejos, como la manda el servidor.
      queryClient.setQueryData(clave, (lista = []) => [provisorio, ...lista]);

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
