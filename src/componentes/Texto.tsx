import { Text, type TextProps } from 'react-native';

import { colores, tipografia, type Color, type VarianteTexto } from '@/tema';

const colorPorVariante: Partial<Record<VarianteTexto, Color>> = {
  secundario: 'textoSecundario',
  chica: 'textoSecundario',
  etiqueta: 'tealTexto',
};

type Props = TextProps & {
  variante?: VarianteTexto;
  color?: Color;
  centrado?: boolean;
};

export function Texto({ variante = 'cuerpo', color, centrado, style, ...resto }: Props) {
  const colorFinal = colores[color ?? colorPorVariante[variante] ?? 'texto'];

  return (
    <Text
      style={[tipografia[variante], { color: colorFinal }, centrado && { textAlign: 'center' }, style]}
      {...resto}
    />
  );
}
