import { StyleSheet, View } from 'react-native';

import { colores } from '@/tema';

export function Separador() {
  return <View style={estilos.linea} />;
}

const estilos = StyleSheet.create({
  linea: {
    height: 1,
    backgroundColor: colores.separador,
  },
});
