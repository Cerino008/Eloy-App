import { Pressable, StyleSheet } from 'react-native';

import { espacio, toqueMinimo } from '@/tema';
import { Texto } from './Texto';

type Props = {
  titulo: string;
  onPress: () => void;
  deshabilitado?: boolean;
};

// Un link: para acciones secundarias como "Crear cuenta" o "Cerrar sesión".
export function BotonTexto({ titulo, onPress, deshabilitado }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: deshabilitado }}
      hitSlop={espacio[2]}
      style={({ pressed }) => [estilos.base, (pressed || deshabilitado) && estilos.apagado]}
    >
      <Texto variante="cuerpoFuerte" style={estilos.texto}>
        {titulo}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: toqueMinimo,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: espacio[3],
  },
  texto: { textDecorationLine: 'underline' },
  apagado: { opacity: 0.6 },
});
