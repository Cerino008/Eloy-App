import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { aHoraTexto, nombreDeFecha } from '@/fechas';
import { colores, espacio, radio, toqueMinimo } from '@/tema';
import { Texto } from './Texto';

type Props = {
  etiqueta: string;
  modo: 'time' | 'date';
  valor: Date;
  onCambiar: (fecha: Date) => void;
  minimo?: Date;
};

// Una fila con la etiqueta y el selector del sistema. En iPhone se usa el selector compacto;
// en Android, un botón con el valor que abre el diálogo del sistema.
export function SelectorFechaHora({ etiqueta, modo, valor, onCambiar, minimo }: Props) {
  const texto = modo === 'time' ? aHoraTexto(valor) : nombreDeFecha(valor);

  return (
    <View style={estilos.fila}>
      <Texto variante="cuerpoFuerte" style={estilos.etiqueta}>
        {etiqueta}
      </Texto>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={valor}
          mode={modo}
          display="compact"
          // es-AR en iOS muestra la hora con a. m./p. m.; es-ES la muestra en 24 horas, como el resto de la app.
          locale={modo === 'time' ? 'es-ES' : 'es-AR'}
          themeVariant="light"
          accentColor={colores.texto}
          minimumDate={minimo}
          accessibilityLabel={etiqueta}
          onChange={(_evento, fecha) => fecha && onCambiar(fecha)}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${etiqueta}: ${texto}. Tocá para cambiar`}
          style={({ pressed }) => [estilos.valorAndroid, pressed && estilos.presionado]}
          onPress={() =>
            DateTimePickerAndroid.open({
              value: valor,
              mode: modo,
              is24Hour: true,
              minimumDate: minimo,
              onChange: (evento, fecha) => {
                if (evento.type === 'set' && fecha) onCambiar(fecha);
              },
            })
          }
        >
          <Texto variante="cuerpoFuerte">{texto}</Texto>
        </Pressable>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio[3],
    minHeight: 52,
  },
  etiqueta: { flex: 1 },
  valorAndroid: {
    minHeight: toqueMinimo,
    justifyContent: 'center',
    paddingHorizontal: espacio[4],
    borderRadius: radio.pill,
    backgroundColor: colores.neutroSuave,
  },
  presionado: { opacity: 0.7 },
});
