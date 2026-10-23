import { Pressable, StyleSheet, View } from 'react-native';

import type { DiaSemana } from '@/api/tipos';
import { DIAS_SEMANA, NOMBRE_DIA } from '@/recordatorios';
import { colores, espacio, fuentes, radio } from '@/tema';
import { Texto } from './Texto';

const CORTO: Record<DiaSemana, string> = {
  lunes: 'Lu',
  martes: 'Ma',
  miercoles: 'Mi',
  jueves: 'Ju',
  viernes: 'Vi',
  sabado: 'Sá',
  domingo: 'Do',
};

type Props = {
  seleccionados: DiaSemana[];
  onCambiar: (dias: DiaSemana[]) => void;
};

// Los 7 días para tocar; se pueden marcar varios.
export function SelectorDias({ seleccionados, onCambiar }: Props) {
  const alternar = (dia: DiaSemana) => {
    const marcado = seleccionados.includes(dia);
    // Siempre en el orden de la semana, sin importar en qué orden se tocaron.
    onCambiar(DIAS_SEMANA.filter((d) => (d === dia ? !marcado : seleccionados.includes(d))));
  };

  return (
    <View style={estilos.fila}>
      {DIAS_SEMANA.map((dia) => {
        const marcado = seleccionados.includes(dia);
        return (
          <Pressable
            key={dia}
            onPress={() => alternar(dia)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marcado }}
            accessibilityLabel={NOMBRE_DIA[dia]}
            style={({ pressed }) => [estilos.dia, marcado && estilos.marcado, pressed && estilos.presionado]}
          >
            <Texto
              variante="secundario"
              color={marcado ? 'textoSobreOscuro' : 'texto'}
              style={estilos.texto}
              maxFontSizeMultiplier={1.3}
            >
              {CORTO[dia]}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    gap: espacio[1] + 2,
  },
  dia: {
    flex: 1,
    height: 48,
    borderRadius: radio.boton,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcado: {
    backgroundColor: colores.texto,
    borderColor: colores.texto,
  },
  presionado: { opacity: 0.7 },
  texto: { fontFamily: fuentes.semi },
});
