import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colores, espacio, margenPantalla, type Color } from '@/tema';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  fondo?: Color;
  // Con pestañas abajo, la barra ya respeta el borde inferior.
  bordes?: Edge[];
};

export function Pantalla({ children, scroll = true, fondo = 'fondo', bordes = ['top', 'left', 'right'] }: Props) {
  const colorFondo = { backgroundColor: colores[fondo] };

  return (
    <SafeAreaView style={[estilos.base, colorFondo]} edges={bordes}>
      {scroll ? (
        <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[estilos.base, estilos.contenido]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  base: { flex: 1 },
  contenido: {
    paddingHorizontal: margenPantalla,
    paddingTop: espacio[4],
    paddingBottom: espacio[8],
  },
});
