import { useEffect, useState } from 'react';

// La hora actual, renovada cada `cadaMs`, para textos como "hace 5 minutos" que tienen que avanzar solos.
export function useAhora(cadaMs: number): Date {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), cadaMs);
    return () => clearInterval(intervalo);
  }, [cadaMs]);

  return ahora;
}
