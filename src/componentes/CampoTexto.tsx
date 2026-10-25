import { CircleAlert } from 'lucide-react-native';
import type { Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

import { colores, espacio, fuentes, radio, tipografia } from '@/tema';
import { Texto } from './Texto';

type Props = Omit<TextInputProps, 'style'> & {
  etiqueta: string;
  // Lo que está mal en este campo: aparece debajo, en rojo, y el borde se pone rojo.
  error?: string | null;
  // Para códigos cortos (ej. el de Eloy): letras grandes, centradas y separadas.
  codigo?: boolean;
  ref?: Ref<TextInputInstance>;
};

// Campo de formulario con la etiqueta arriba.
export function CampoTexto({ etiqueta, multiline, error, codigo, ref, ...resto }: Props) {
  return (
    <View style={estilos.base}>
      <Texto variante="cuerpoFuerte">{etiqueta}</Texto>
      <TextInput
        ref={ref}
        accessibilityLabel={error ? `${etiqueta}. ${error}` : etiqueta}
        placeholderTextColor={colores.textoSecundario}
        multiline={multiline}
        style={[estilos.campo, multiline && estilos.multilinea, codigo && estilos.codigo, error && estilos.conError]}
        {...resto}
      />
      {error && (
        <View style={estilos.error} accessibilityLiveRegion="polite">
          <CircleAlert size={16} color={colores.alerta} strokeWidth={2.4} />
          <Texto variante="chica" color="alerta" style={estilos.textoError}>
            {error}
          </Texto>
        </View>
      )}
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
  codigo: {
    minHeight: 64,
    fontFamily: fuentes.bold,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
  },
  // Más grueso, para que se note también sin distinguir el color.
  conError: {
    borderWidth: 2,
    borderColor: colores.alerta,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[2],
  },
  textoError: { flexShrink: 1 },
});
