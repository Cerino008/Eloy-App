import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colores, espacio, radio, type Color } from '@/tema';

type Props = {
  children: ReactNode;
  // Para listas con Separador: las filas ponen su propio espacio vertical.
  lista?: boolean;
  fondo?: Color;
  style?: StyleProp<ViewStyle>;
};

export function Tarjeta({ children, lista, fondo = 'superficie', style }: Props) {
  return (
    <View style={[estilos.base, lista && estilos.lista, { backgroundColor: colores[fondo] }, style]}>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  base: {
    borderRadius: radio.tarjeta,
    padding: espacio[5],
  },
  lista: {
    paddingVertical: espacio[1],
  },
});
