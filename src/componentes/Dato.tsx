import { StyleSheet, View } from 'react-native';

import { espacio } from '@/tema';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';

type Props = {
  valor: string | number;
  etiqueta: string;
  // Para cuando el valor no se lee bien en voz alta, ej. "2 de 3 recordatorios".
  accessibilityLabel?: string;
};

// Uno de los números del resumen de Inicio ("3 charlas").
export function Dato({ valor, etiqueta, accessibilityLabel }: Props) {
  return (
    <Tarjeta style={estilos.tarjeta}>
      <View accessible accessibilityLabel={accessibilityLabel ?? `${valor} ${etiqueta}`} style={estilos.contenido}>
        <Texto variante="numero" centrado>
          {valor}
        </Texto>
        <Texto variante="secundario" centrado numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.87}>
          {etiqueta}
        </Texto>
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    flex: 1,
    paddingHorizontal: espacio[2],
    paddingVertical: espacio[4],
  },
  contenido: {
    alignItems: 'center',
    gap: espacio[1],
  },
});
