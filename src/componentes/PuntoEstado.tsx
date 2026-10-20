import { View } from 'react-native';

import type { EstadoPersona } from '@/api/tipos';
import { colores, type Color } from '@/tema';

const colorPorEstado: Record<EstadoPersona, Color> = {
  bien: 'teal',
  atencion: 'accion',
  sin_conexion: 'textoSecundario',
  alerta: 'alerta',
};

type Props = {
  estado: EstadoPersona;
  tamano?: number;
};

// Decorativo: el texto de al lado dice el estado; el color solo lo refuerza.
export function PuntoEstado({ estado, tamano = 12 }: Props) {
  return (
    <View
      accessible={false}
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        backgroundColor: colores[colorPorEstado[estado]],
      }}
    />
  );
}
