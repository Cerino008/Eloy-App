import { Play } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { duracion } from '@/fechas';
import { colores, espacio, toqueMinimo } from '@/tema';
import { Texto } from './Texto';

// Alturas fijas: la onda es decorativa, no sale del audio.
const ONDA = [10, 18, 26, 14, 22, 28, 16, 24, 12, 20, 14, 8];

type Props = {
  duracionSeg: number;
  // Todavía no reproduce: se conecta cuando el backend mande audioUrl.
  onPress?: () => void;
};

export function ReproductorAudio({ duracionSeg, onPress }: Props) {
  return (
    <View style={estilos.base}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Escuchar audio, ${Math.round(duracionSeg)} segundos`}
        style={({ pressed }) => [estilos.play, pressed && estilos.presionado]}
      >
        <Play size={20} color={colores.texto} fill={colores.texto} strokeWidth={2} />
      </Pressable>

      <View style={estilos.onda} accessible={false} importantForAccessibility="no-hide-descendants">
        {ONDA.map((alto, i) => (
          <View key={i} style={[estilos.barra, { height: alto }]} />
        ))}
      </View>

      <Texto variante="secundario" accessible={false} style={estilos.duracion}>
        {duracion(duracionSeg)}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
  },
  play: {
    width: toqueMinimo,
    height: toqueMinimo,
    borderRadius: toqueMinimo / 2,
    backgroundColor: colores.accion,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presionado: { opacity: 0.85 },
  onda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  barra: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colores.textoSecundario,
    opacity: 0.5,
  },
  duracion: {
    marginLeft: 'auto',
    paddingLeft: espacio[3],
  },
});
