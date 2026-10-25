import { StyleSheet, View } from 'react-native';

import { colores, espacio, radio } from '@/tema';

type Props = {
  actual: number;
  total: number;
};

// Las barritas de "Paso 2 de 3": hechas en naranja, las que faltan en gris.
export function Pasos({ actual, total }: Props) {
  return (
    <View style={estilos.fila} accessible accessibilityLabel={`Paso ${actual} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[estilos.barra, i < actual && estilos.hecha]} />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    gap: espacio[2],
  },
  barra: {
    flex: 1,
    height: 6,
    borderRadius: radio.pill,
    backgroundColor: colores.separador,
  },
  hecha: { backgroundColor: colores.accion },
});
