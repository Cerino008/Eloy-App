import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from './cliente';

// Si en 2 minutos Eloy no lo aplicó, se deja de esperar: seguramente está sin conexión.
const ESPERA_MAXIMA_MS = 2 * 60 * 1000;

// El backend responde 202: Eloy cambia el volumen recién en su próxima sincronización, así que no se da
// por hecho. Mientras tanto se recuerda lo pedido:
// - volumenPedido: lo que se pidió y Eloy todavía no aplicó (null si no hay nada pendiente).
// - esperando: hay que recargar para ver cuándo lo aplica.
// - demorado: pasaron 2 minutos y no lo aplicó.
// Si el pedido falla, vuelve al volumen de antes y avisa con `alFallar`.
export function useCambiarVolumen(idDispositivo: number, volumenActual: number, alFallar: () => void) {
  const [pedido, setPedido] = useState<{ volumen: number; en: number } | null>(null);
  const [demorado, setDemorado] = useState(false);

  const mutacion = useMutation({
    mutationFn: (volumen: number) => api.cambiarVolumen(idDispositivo, volumen),
    onMutate: (volumen) => {
      setPedido({ volumen, en: Date.now() });
      setDemorado(false);
    },
    onError: () => {
      setPedido(null);
      alFallar();
    },
  });

  const pendiente = pedido !== null && pedido.volumen !== volumenActual;

  useEffect(() => {
    if (!pendiente) return;
    const espera = setTimeout(() => setDemorado(true), ESPERA_MAXIMA_MS);
    return () => clearTimeout(espera);
  }, [pendiente, pedido]);

  return {
    cambiar: (volumen: number) => mutacion.mutate(Math.round(volumen)),
    volumenPedido: pendiente ? pedido.volumen : null,
    esperando: pendiente && !demorado,
    demorado: pendiente && demorado,
  };
}
