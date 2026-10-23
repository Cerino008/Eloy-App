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
  // false para pantallas que van de borde a borde, como el chat.
  relleno?: boolean;
};

export function Pantalla({
  children,
  scroll = true,
  fondo = 'fondo',
  bordes = ['top', 'left', 'right'],
  relleno = true,
}: Props) {
  const colorFondo = { backgroundColor: colores[fondo] };
  const contenido = relleno && estilos.contenido;

  return (
    <SafeAreaView style={[estilos.base, colorFondo]} edges={bordes}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={contenido || undefined}
          keyboardShouldPersistTaps="handled"
          // iOS: deja lugar para el teclado así no tapa los campos de abajo.
          automaticallyAdjustKeyboardInsets
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[estilos.base, contenido]}>{children}</View>
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
