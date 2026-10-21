import { Send } from 'lucide-react-native';
import { StyleSheet, TextInput, View } from 'react-native';

import { colores, espacio, fuentes, tipografia } from '@/tema';
import { BotonIcono } from './BotonIcono';

type Props = {
  valor: string;
  onCambiar: (texto: string) => void;
  onEnviar: () => void;
  placeholder: string;
};

const ALTO_MINIMO = 48;

// Campo de texto de la charla, con el botón de enviar al lado.
export function CampoMensaje({ valor, onCambiar, onEnviar, placeholder }: Props) {
  const vacio = valor.trim().length === 0;

  return (
    <View style={estilos.barra}>
      <TextInput
        value={valor}
        onChangeText={onCambiar}
        placeholder={placeholder}
        placeholderTextColor={colores.textoSecundario}
        accessibilityLabel={placeholder}
        multiline
        maxLength={1000}
        style={estilos.campo}
      />
      <BotonIcono icono={Send} etiqueta="Enviar" variante="principal" onPress={onEnviar} deshabilitado={vacio} />
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espacio[2],
    paddingHorizontal: espacio[4],
    paddingVertical: espacio[3],
    borderTopWidth: 1,
    borderTopColor: colores.separador,
    backgroundColor: colores.fondo,
  },
  campo: {
    flex: 1,
    minHeight: ALTO_MINIMO,
    // Unas 5 líneas; después scrollea adentro.
    maxHeight: 132,
    borderRadius: ALTO_MINIMO / 2,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.campo,
    paddingHorizontal: espacio[5],
    paddingTop: espacio[3],
    paddingBottom: espacio[3],
    fontFamily: fuentes.regular,
    fontSize: tipografia.cuerpo.fontSize,
    color: colores.texto,
  },
});
