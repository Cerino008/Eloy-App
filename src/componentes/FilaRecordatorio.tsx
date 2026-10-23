import { StyleSheet, View } from 'react-native';

import type { Recordatorio } from '@/api/tipos';
import { cuandoSuena } from '@/recordatorios';
import { espacio } from '@/tema';
import { Chip } from './Chip';
import { Texto } from './Texto';

type Props = {
  recordatorio: Recordatorio;
};

// Hora, título, cuándo suena y, si es de hoy, "Sonó" o "Pendiente".
export function FilaRecordatorio({ recordatorio }: Props) {
  const cuando = cuandoSuena(recordatorio);
  const detalle = recordatorio.descripcion ? `${cuando} · ${recordatorio.descripcion}` : cuando;
  const estado =
    recordatorio.estadoHoy === 'sono' ? 'Sonó' : recordatorio.estadoHoy === 'pendiente' ? 'Pendiente' : null;

  return (
    <View
      style={estilos.fila}
      accessible
      accessibilityLabel={[recordatorio.hora, recordatorio.titulo, detalle, estado].filter(Boolean).join(', ')}
    >
      <Texto variante="hora" style={estilos.hora}>
        {recordatorio.hora}
      </Texto>
      <View style={estilos.textos}>
        <Texto variante="cuerpoFuerte">{recordatorio.titulo}</Texto>
        <Texto variante="secundario">{detalle}</Texto>
      </View>
      {estado && <Chip texto={estado} variante={recordatorio.estadoHoy === 'sono' ? 'exito' : 'neutro'} />}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[4],
    paddingVertical: espacio[4],
  },
  // Ancho fijo para que los títulos queden alineados.
  hora: { width: 56 },
  textos: { flex: 1 },
});
