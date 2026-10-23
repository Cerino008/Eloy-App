import { Pressable, StyleSheet, View } from 'react-native';

import { colores, espacio } from '@/tema';
import { Separador } from './Separador';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';

type Opcion<T extends string> = { valor: T; etiqueta: string };

type Props<T extends string> = {
  etiqueta: string;
  opciones: Opcion<T>[];
  valor: T;
  onCambiar: (valor: T) => void;
};

// Lista de opciones donde se elige una sola, con un círculo marcado en la elegida.
export function OpcionUnica<T extends string>({ etiqueta, opciones, valor, onCambiar }: Props<T>) {
  return (
    <Tarjeta lista>
      <View accessibilityRole="radiogroup" accessibilityLabel={etiqueta}>
        {opciones.map((opcion, i) => {
          const elegida = opcion.valor === valor;
          return (
            <View key={opcion.valor}>
              {i > 0 && <Separador />}
              <Pressable
                onPress={() => onCambiar(opcion.valor)}
                accessibilityRole="radio"
                accessibilityState={{ checked: elegida }}
                accessibilityLabel={opcion.etiqueta}
                style={({ pressed }) => [estilos.opcion, pressed && estilos.presionado]}
              >
                <Texto variante={elegida ? 'cuerpoFuerte' : 'cuerpo'} style={estilos.texto}>
                  {opcion.etiqueta}
                </Texto>
                <View style={[estilos.circulo, elegida && estilos.circuloElegido]}>
                  {elegida && <View style={estilos.punto} />}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </Tarjeta>
  );
}

const CIRCULO = 24;

const estilos = StyleSheet.create({
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
    minHeight: 52,
    paddingVertical: espacio[3],
  },
  presionado: { opacity: 0.7 },
  texto: { flex: 1 },
  circulo: {
    width: CIRCULO,
    height: CIRCULO,
    borderRadius: CIRCULO / 2,
    borderWidth: 2,
    borderColor: colores.textoSecundario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuloElegido: { borderColor: colores.texto },
  punto: {
    width: CIRCULO / 2,
    height: CIRCULO / 2,
    borderRadius: CIRCULO / 4,
    backgroundColor: colores.texto,
  },
});
