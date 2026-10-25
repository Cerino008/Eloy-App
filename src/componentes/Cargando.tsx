import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colores, espacio } from '@/tema';
import { Texto } from './Texto';

type Props = {
  texto?: string;
  // En blanco, para que se lea sobre el fondo rojo de Alerta.
  sobreAlerta?: boolean;
};

export function Cargando({ texto = 'Un momento…', sobreAlerta }: Props) {
  return (
    <View style={estilos.base} accessible accessibilityLabel={texto} accessibilityState={{ busy: true }}>
      <ActivityIndicator size="large" color={sobreAlerta ? colores.textoSobreOscuro : colores.texto} />
      <Texto variante="secundario" color={sobreAlerta ? 'textoSobreOscuro' : 'textoSecundario'}>
        {texto}
      </Texto>
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
