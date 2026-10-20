import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { alturaBoton, colores, espacio, radio, type Color } from '@/tema';
import { Texto } from './Texto';

// principal: el naranja, uno solo por pantalla.
// alertaClaro / alertaContorno: solo sobre el fondo rojo de la alerta.
type Variante = 'principal' | 'contorno' | 'peligro' | 'alertaClaro' | 'alertaContorno';

const estiloPorVariante: Record<Variante, { fondo: Color | null; borde: Color | null; texto: Color }> = {
  principal: { fondo: 'accion', borde: null, texto: 'texto' },
  contorno: { fondo: null, borde: 'texto', texto: 'texto' },
  peligro: { fondo: null, borde: 'alerta', texto: 'alerta' },
  alertaClaro: { fondo: 'superficie', borde: null, texto: 'alertaOscuro' },
  alertaContorno: { fondo: null, borde: 'textoSobreOscuro', texto: 'textoSobreOscuro' },
};

type Props = {
  titulo: string;
  onPress: () => void;
  variante?: Variante;
  icono?: LucideIcon;
  deshabilitado?: boolean;
  cargando?: boolean;
};

export function Boton({ titulo, onPress, variante = 'principal', icono: Icono, deshabilitado, cargando }: Props) {
  const v = estiloPorVariante[variante];
  const colorTexto = colores[v.texto];
  const inactivo = deshabilitado || cargando;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      style={({ pressed }) => [
        estilos.base,
        v.fondo && { backgroundColor: colores[v.fondo] },
        v.borde && { borderWidth: 2, borderColor: colores[v.borde] },
        pressed && estilos.presionado,
        deshabilitado && estilos.deshabilitado,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <View style={estilos.contenido}>
          {Icono && <Icono size={22} color={colorTexto} strokeWidth={2.2} />}
          <Texto variante="boton" style={{ color: colorTexto }}>
            {titulo}
          </Texto>
        </View>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: alturaBoton,
    borderRadius: radio.boton,
    paddingHorizontal: espacio[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  contenido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
  },
  presionado: { opacity: 0.85 },
  deshabilitado: { opacity: 0.5 },
});
