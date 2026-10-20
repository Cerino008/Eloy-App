import { StyleSheet, View } from 'react-native';

import { colores, fuentes, type Color } from '@/tema';
import { Texto } from './Texto';

// persona: la persona mayor (Marta). yo: quien usa la app. familiar: el resto.
type Variante = 'persona' | 'yo' | 'familiar';

const colorPorVariante: Record<Variante, { fondo: Color; texto: Color }> = {
  persona: { fondo: 'texto', texto: 'textoSobreOscuro' },
  yo: { fondo: 'accion', texto: 'texto' },
  familiar: { fondo: 'tealSuave', texto: 'texto' },
};

type Props = {
  nombre: string;
  variante?: Variante;
  tamano?: number;
};

export function Avatar({ nombre, variante = 'familiar', tamano = 40 }: Props) {
  const c = colorPorVariante[variante];
  const inicial = nombre.trim().charAt(0).toUpperCase();

  return (
    // Decorativo: el nombre siempre aparece al lado.
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        estilos.base,
        { width: tamano, height: tamano, borderRadius: tamano / 2, backgroundColor: colores[c.fondo] },
      ]}
    >
      <Texto
        color={c.texto}
        style={{ fontFamily: fuentes.bold, fontSize: Math.round(tamano * 0.42), lineHeight: Math.round(tamano * 0.55) }}
      >
        {inicial}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
