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
  // alerta: play rojo y onda rosada, para la pantalla de Alerta.
  variante?: 'normal' | 'alerta';
};

export function ReproductorAudio({ duracionSeg, onPress, variante = 'normal' }: Props) {
  const enAlerta = variante === 'alerta';
  const colorIcono = enAlerta ? colores.textoSobreOscuro : colores.texto;

  return (
    <View style={estilos.base}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Escuchar audio, ${Math.round(duracionSeg)} segundos`}
        style={({ pressed }) => [estilos.play, enAlerta && estilos.playAlerta, pressed && estilos.presionado]}
      >
        <Play size={20} color={colorIcono} fill={colorIcono} strokeWidth={2} />
      </Pressable>

      <View style={estilos.onda} accessible={false} importantForAccessibility="no-hide-descendants">
        {ONDA.map((alto, i) => (
          <View key={i} style={[estilos.barra, enAlerta && estilos.barraAlerta, { height: alto }]} />
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
  playAlerta: { backgroundColor: colores.alerta },
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
  barraAlerta: {
    backgroundColor: colores.alerta,
    opacity: 0.4,
  },
  duracion: {
    marginLeft: 'auto',
    paddingLeft: espacio[3],
  },
});
