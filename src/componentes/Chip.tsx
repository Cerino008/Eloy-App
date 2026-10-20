import { StyleSheet, View } from 'react-native';

import { colores, espacio, fuentes, radio, type Color } from '@/tema';
import { Texto } from './Texto';

// exito: "Sonó". neutro: "Pendiente", "Hoy".
type Variante = 'exito' | 'neutro';

const colorPorVariante: Record<Variante, { fondo: Color; texto: Color }> = {
  exito: { fondo: 'tealSuave', texto: 'tealTexto' },
  neutro: { fondo: 'neutroSuave', texto: 'textoSecundario' },
};

type Props = {
  texto: string;
  variante?: Variante;
};

export function Chip({ texto, variante = 'neutro' }: Props) {
  const c = colorPorVariante[variante];

  return (
    <View style={[estilos.base, { backgroundColor: colores[c.fondo] }]}>
      <Texto variante="secundario" color={c.texto} style={estilos.texto}>
        {texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radio.pill,
    paddingHorizontal: espacio[4],
    paddingVertical: espacio[1] + 2,
  },
  texto: { fontFamily: fuentes.semi },
});
