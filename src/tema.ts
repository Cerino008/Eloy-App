import type { TextStyle } from 'react-native';

// Única fuente de estilos de la app. Las pantallas y componentes toman de acá
// colores, tipografía y espacios; no usan valores sueltos.

export const colores = {
  fondo: '#F4F1EA',
  superficie: '#FFFFFF',
  texto: '#1F3A4D',
  textoSecundario: '#4E5F6C',
  textoSobreOscuro: '#FFFFFF',

  // Un solo botón naranja por pantalla, con texto en azul petróleo.
  accion: '#F28C28',

  teal: '#3E9A8A',
  tealSuave: '#E3F1EE',
  // Teal más oscuro para texto chico: el teal normal no llega a 4,5:1 sobre blanco.
  tealTexto: '#287366',

  // Solo para emergencias.
  alerta: '#B3302F',
  alertaOscuro: '#93262A',

  separador: '#ECE7DC',
  neutroSuave: '#EFEBE3',
  campo: '#F8F6F1',
  bordeCampo: '#E2DDD1',
} as const;

export type Color = keyof typeof colores;

export const fuentes = {
  regular: 'PlusJakartaSans_400Regular',
  medio: 'PlusJakartaSans_500Medium',
  semi: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extra: 'PlusJakartaSans_800ExtraBold',
} as const;

// Nunca menos de 13.
export const tipografia = {
  tituloGrande: { fontFamily: fuentes.extra, fontSize: 34, lineHeight: 40 },
  titulo: { fontFamily: fuentes.bold, fontSize: 28, lineHeight: 34 },
  subtitulo: { fontFamily: fuentes.bold, fontSize: 20, lineHeight: 26 },
  cuerpo: { fontFamily: fuentes.regular, fontSize: 17, lineHeight: 24 },
  cuerpoFuerte: { fontFamily: fuentes.semi, fontSize: 17, lineHeight: 24 },
  secundario: { fontFamily: fuentes.regular, fontSize: 15, lineHeight: 21 },
  etiqueta: {
    fontFamily: fuentes.bold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  chica: { fontFamily: fuentes.regular, fontSize: 13, lineHeight: 18 },
  numero: { fontFamily: fuentes.extra, fontSize: 28, lineHeight: 34 },
  hora: { fontFamily: fuentes.bold, fontSize: 17, lineHeight: 24, fontVariant: ['tabular-nums'] },
  boton: { fontFamily: fuentes.bold, fontSize: 17, lineHeight: 22 },
} as const satisfies Record<string, TextStyle>;

export type VarianteTexto = keyof typeof tipografia;

export const espacio = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
} as const;

export const margenPantalla = espacio[5];

export const radio = {
  tarjeta: 16,
  boton: 16,
  pill: 999,
} as const;

export const toqueMinimo = 44;
export const alturaBoton = 56;
