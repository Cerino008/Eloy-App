import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colores, espacio, fuentes, radio, tipografia } from '@/tema';
import { Texto } from './Texto';

type Props = Omit<TextInputProps, 'style'> & {
  etiqueta: string;
};

// Campo de formulario con la etiqueta arriba.
export function CampoTexto({ etiqueta, multiline, ...resto }: Props) {
  return (
    <View style={estilos.base}>
      <Texto variante="cuerpoFuerte">{etiqueta}</Texto>
      <TextInput
        accessibilityLabel={etiqueta}
        placeholderTextColor={colores.textoSecundario}
        multiline={multiline}
        style={[estilos.campo, multiline && estilos.multilinea]}
        {...resto}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  base: { gap: espacio[2] },
  campo: {
    minHeight: 52,
    borderRadius: radio.boton,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
    paddingHorizontal: espacio[4],
    paddingVertical: espacio[3],
    fontFamily: fuentes.regular,
    fontSize: tipografia.cuerpo.fontSize,
    color: colores.texto,
  },
  multilinea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
});
