import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';

const CADA_MS = 15 * 1000;

// Mientras se espera algo que hace Eloy (un volumen pedido, una restauración), recarga cada 15 segundos,
// pero solo con la pantalla a la vista.
export function useRecargarMientras(activo: boolean, recargar: () => void) {
  const visible = useIsFocused();

  useEffect(() => {
    if (!activo || !visible) return;
    const intervalo = setInterval(recargar, CADA_MS);
    return () => clearInterval(intervalo);
  }, [activo, visible, recargar]);
}
