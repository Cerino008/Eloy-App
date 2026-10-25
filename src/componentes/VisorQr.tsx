import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { colores, espacio, radio } from '@/tema';
import { Boton } from './Boton';
import { Cargando } from './Cargando';
import { Texto } from './Texto';

type Props = {
  // Lo que trae el QR, tal cual (puede ser el código solo o un link).
  onLeer: (texto: string) => void;
  // Mientras se revisa un código no se leen otros.
  pausado?: boolean;
};

// Tiempo antes de volver a aceptar un QR: la cámara lo ve muchas veces por segundo.
const ESPERA_ENTRE_LECTURAS_MS = 2000;

// El recuadro oscuro del QR: la cámara si hay permiso; si no, cómo darlo.
export function VisorQr({ onLeer, pausado }: Props) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const leyendo = useRef(false);

  const leer = ({ data }: { data: string }) => {
    if (leyendo.current) return;
    leyendo.current = true;
    onLeer(data);
    setTimeout(() => {
      leyendo.current = false;
    }, ESPERA_ENTRE_LECTURAS_MS);
  };

  let contenido;
  if (!permiso) {
    contenido = null; // todavía no sabemos si hay permiso: un instante
  } else if (permiso.granted) {
    contenido = pausado ? (
      <Cargando texto="Revisando el código…" sobreAlerta />
    ) : (
      <>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={leer}
          accessibilityLabel="Vista de la cámara para leer el código QR de Eloy"
        />
        <Esquinas />
      </>
    );
  } else if (permiso.canAskAgain) {
    contenido = (
      <View style={estilos.mensaje}>
        <Texto color="textoSobreOscuro" centrado>
          Para leer el código, la app necesita usar la cámara. Solo la usa en esta pantalla.
        </Texto>
        <Boton titulo="Usar la cámara" onPress={pedirPermiso} />
      </View>
    );
  } else {
    // Ya lo negaron: el sistema no vuelve a preguntar, se cambia en Ajustes.
    contenido = (
      <View style={estilos.mensaje}>
        <Texto color="textoSobreOscuro" centrado>
          No tenemos permiso para usar la cámara. Podés darlo en Ajustes o escribir el código a mano.
        </Texto>
        <Boton titulo="Abrir Ajustes" onPress={() => Linking.openSettings()} />
      </View>
    );
  }

  return <View style={estilos.visor}>{contenido}</View>;
}

// Las cuatro esquinas naranjas que marcan dónde poner el QR.
function Esquinas() {
  return (
    <View style={estilos.marco} pointerEvents="none">
      <View style={[estilos.esquina, estilos.arribaIzquierda]} />
      <View style={[estilos.esquina, estilos.arribaDerecha]} />
      <View style={[estilos.esquina, estilos.abajoIzquierda]} />
      <View style={[estilos.esquina, estilos.abajoDerecha]} />
    </View>
  );
}

const LARGO_ESQUINA = 48;
const GROSOR_ESQUINA = 5;

const estilos = StyleSheet.create({
  visor: {
    // Un poco más ancho que alto, para que entre con el botón de abajo sin scrollear.
    aspectRatio: 1.2,
    borderRadius: radio.tarjeta,
    overflow: 'hidden',
    backgroundColor: colores.texto,
    justifyContent: 'center',
  },
  mensaje: {
    gap: espacio[5],
    padding: espacio[6],
  },
  // Cuadrado, como el QR, y centrado (el visor tiene justifyContent: 'center').
  marco: {
    height: '64%',
    aspectRatio: 1,
    alignSelf: 'center',
  },
  esquina: {
    position: 'absolute',
    width: LARGO_ESQUINA,
    height: LARGO_ESQUINA,
    borderColor: colores.accion,
  },
  arribaIzquierda: {
    top: 0,
    left: 0,
    borderTopWidth: GROSOR_ESQUINA,
    borderLeftWidth: GROSOR_ESQUINA,
    borderTopLeftRadius: radio.tarjeta,
  },
  arribaDerecha: {
    top: 0,
    right: 0,
    borderTopWidth: GROSOR_ESQUINA,
    borderRightWidth: GROSOR_ESQUINA,
    borderTopRightRadius: radio.tarjeta,
  },
  abajoIzquierda: {
    bottom: 0,
    left: 0,
    borderBottomWidth: GROSOR_ESQUINA,
    borderLeftWidth: GROSOR_ESQUINA,
    borderBottomLeftRadius: radio.tarjeta,
  },
  abajoDerecha: {
    bottom: 0,
    right: 0,
    borderBottomWidth: GROSOR_ESQUINA,
    borderRightWidth: GROSOR_ESQUINA,
    borderBottomRightRadius: radio.tarjeta,
  },
});
