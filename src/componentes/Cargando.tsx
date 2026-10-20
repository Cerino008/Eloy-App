import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colores, espacio } from '@/tema';
import { Texto } from './Texto';

type Props = {
  texto?: string;
};

export function Cargando({ texto = 'Un momento…' }: Props) {
  return (
    <View style={estilos.base} accessible accessibilityLabel={texto} accessibilityState={{ busy: true }}>
      <ActivityIndicator size="large" color={colores.texto} />
      <Texto variante="secundario">{texto}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  base: {
    alignItems: 'center',
    gap: espacio[3],
    paddingVertical: espacio[8] * 2,
  },
});
