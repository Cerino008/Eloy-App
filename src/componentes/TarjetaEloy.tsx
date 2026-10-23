import Slider from '@react-native-community/slider';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { Dispositivo } from '@/api/tipos';
import { cuandoFue } from '@/fechas';
import { colores, espacio } from '@/tema';
import { PuntoEstado } from './PuntoEstado';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';

type Props = {
  dispositivo: Dispositivo;
  // Se llama al soltar el slider, no en cada movimiento.
  onCambiarVolumen: (volumen: number) => void;
};

function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={estilos.dato} accessible accessibilityLabel={`${etiqueta}: ${valor}`}>
      <Texto color="textoSecundario">{etiqueta}</Texto>
      <Texto variante="cuerpoFuerte" style={estilos.valor} numberOfLines={1}>
        {valor}
      </Texto>
    </View>
  );
}

// Estado de Eloy: conexión, WiFi, volumen y versión.
export function TarjetaEloy({ dispositivo, onCambiarVolumen }: Props) {
  // El porcentaje sigue al dedo; el slider solo se mueve con el valor guardado,
  // así no salta mientras se arrastra y vuelve solo si guardar falla.
  const [volumen, setVolumen] = useState(dispositivo.volumen);
  useEffect(() => setVolumen(dispositivo.volumen), [dispositivo.volumen]);

  return (
    <Tarjeta style={estilos.tarjeta}>
      <View style={estilos.estado}>
        <PuntoEstado estado={dispositivo.conectado ? 'bien' : 'sin_conexion'} />
        <Texto variante="subtitulo" style={estilos.flex}>
          {dispositivo.conectado ? 'Conectado' : 'Sin conexión'}
        </Texto>
        {dispositivo.ultimaConexion && (
          <Texto
            variante="secundario"
            accessibilityLabel={`Última conexión: ${cuandoFue(dispositivo.ultimaConexion)}`}
          >
            {cuandoFue(dispositivo.ultimaConexion)}
          </Texto>
        )}
      </View>

      <FilaDato etiqueta="WiFi" valor={dispositivo.wifiSsid ?? 'Sin datos'} />

      <View>
        <View style={estilos.dato}>
          <Texto color="textoSecundario">Volumen</Texto>
          <Texto variante="cuerpoFuerte">{volumen} %</Texto>
        </View>
        <Slider
          value={dispositivo.volumen}
          minimumValue={0}
          maximumValue={100}
          step={5}
          onValueChange={setVolumen}
          onSlidingComplete={onCambiarVolumen}
          minimumTrackTintColor={colores.texto}
          maximumTrackTintColor={colores.separador}
          // En iOS queda el botón blanco del sistema; teñido se ve como una cápsula pesada.
          thumbTintColor={Platform.OS === 'android' ? colores.texto : undefined}
          accessibilityLabel="Volumen de Eloy"
          accessibilityValue={{ text: `${volumen} %` }}
          style={estilos.slider}
        />
      </View>

      <FilaDato etiqueta="Versión" valor={dispositivo.versionSoftware ?? 'Sin datos'} />
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { gap: espacio[3] },
  flex: { flex: 1 },
  estado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
  },
  dato: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio[4],
  },
  valor: { flexShrink: 1 },
  slider: { height: 44 },
});
