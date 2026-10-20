import { ChevronRight, TriangleAlert } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colores, espacio, radio } from '@/tema';
import { Texto } from './Texto';

type Props = {
  titulo: string;
  detalle: string;
  onPress: () => void;
};

// Cartel rojo que lleva a la pantalla de Alerta. Solo para emergencias.
export function CartelAlerta({ titulo, detalle, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${detalle}`}
      style={({ pressed }) => [estilos.base, pressed && estilos.presionado]}
    >
      <TriangleAlert size={28} color={colores.textoSobreOscuro} strokeWidth={2} />
      <View style={estilos.textos}>
        <Texto variante="cuerpoFuerte" color="textoSobreOscuro">
          {titulo}
        </Texto>
        <Texto variante="secundario" color="textoSobreOscuro">
          {detalle}
        </Texto>
      </View>
      <ChevronRight size={24} color={colores.textoSobreOscuro} strokeWidth={2} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
    backgroundColor: colores.alerta,
    borderRadius: radio.tarjeta,
    padding: espacio[4],
  },
  textos: { flex: 1 },
  presionado: { opacity: 0.85 },
});
