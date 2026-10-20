import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { colores, type Color } from '@/tema';

// claro: engranaje, volver. suave: micrófono. principal: enviar.
type Variante = 'claro' | 'suave' | 'principal';

const fondoPorVariante: Record<Variante, Color> = {
  claro: 'superficie',
  suave: 'neutroSuave',
  principal: 'accion',
};

type Props = {
  icono: LucideIcon;
  // Obligatoria: el botón no tiene texto visible.
  etiqueta: string;
  onPress: () => void;
  variante?: Variante;
  deshabilitado?: boolean;
};

// Más grande que el toque mínimo de 44.
const TAMANO = 48;

export function BotonIcono({ icono: Icono, etiqueta, onPress, variante = 'claro', deshabilitado }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      style={({ pressed }) => [
        estilos.base,
        { backgroundColor: colores[fondoPorVariante[variante]] },
        pressed && estilos.presionado,
        deshabilitado && estilos.deshabilitado,
      ]}
    >
      <Icono size={24} color={colores.texto} strokeWidth={2} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    width: TAMANO,
    height: TAMANO,
    borderRadius: TAMANO / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presionado: { opacity: 0.8 },
  deshabilitado: { opacity: 0.5 },
});
