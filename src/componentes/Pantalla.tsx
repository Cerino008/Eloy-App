import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { colores, espacio, margenPantalla, type Color } from '@/tema';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  fondo?: Color;
  // Con pestañas abajo, la barra ya respeta el borde inferior. En una hoja (modal) va sin 'top':
  // los márgenes son los de la pantalla entera y la hoja ya arranca debajo del reloj.
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
  // Márgenes del reloj y la barra de inicio. No se usa SafeAreaView: en un modal a pantalla
  // completa (Alerta) daba 0 arriba y el encabezado quedaba debajo del reloj.
  const insets = useSafeAreaInsets();
  const margenes = {
    paddingTop: bordes.includes('top') ? insets.top : 0,
    paddingBottom: bordes.includes('bottom') ? insets.bottom : 0,
    paddingLeft: bordes.includes('left') ? insets.left : 0,
    paddingRight: bordes.includes('right') ? insets.right : 0,
  };
  const colorFondo = { backgroundColor: colores[fondo] };
  const contenido = relleno && estilos.contenido;

  return (
    <View style={[estilos.base, colorFondo, margenes]}>
      {scroll ? (
        <ScrollView
          // flexGrow: si sobra lugar, el contenido llena la pantalla (ej. botones pegados abajo en Alerta).
          contentContainerStyle={[estilos.crece, contenido]}
          keyboardShouldPersistTaps="handled"
          // iOS: deja lugar para el teclado así no tapa los campos de abajo.
          automaticallyAdjustKeyboardInsets
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[estilos.base, contenido]}>{children}</View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  base: { flex: 1 },
  crece: { flexGrow: 1 },
  contenido: {
    paddingHorizontal: margenPantalla,
    paddingTop: espacio[4],
    paddingBottom: espacio[8],
  },
});
