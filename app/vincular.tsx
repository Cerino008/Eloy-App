import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { consultas } from '@/api/consultas';
import { ErrorApi } from '@/api/errores';
import { useVincular } from '@/api/useVincular';
import {
  Boton,
  BotonIcono,
  BotonTexto,
  CampoTexto,
  Consejo,
  Pantalla,
  Pasos,
  Texto,
  VisorQr,
} from '@/componentes';
import { codigoDeTexto, esCodigoVinculacion, LARGO_VINCULACION, limpiarCodigoVinculacion } from '@/codigos';
import { espacio } from '@/tema';
import { errorNombre } from '@/validaciones';

const CONSEJO = '¿No ves el código? Mantené el dedo apoyado 3 segundos en el centro de la pantalla de Eloy.';

// Se llega desde la bienvenida (todavía no sigo a nadie: después del código se pide el nombre de la
// persona y se crea) o desde Familia sin Eloy (es para la persona actual: no se pregunta nada).
export default function Vincular() {
  const router = useRouter();
  const persona = useQuery(consultas.personas).data?.[0];
  const vincular = useVincular();

  const [modo, setModo] = useState<'camara' | 'manual'>('camara');
  const [pidiendoNombre, setPidiendoNombre] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [intentoCodigo, setIntentoCodigo] = useState(false);
  // Lo que respondió el servidor sobre el código; se borra al cambiarlo.
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [avisoQr, setAvisoQr] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [intentoNombre, setIntentoNombre] = useState(false);

  const codigoIncompleto = codigo.length < LARGO_VINCULACION ? `Faltan letras: el código tiene ${LARGO_VINCULACION}.` : null;
  const errorCodigo = (intentoCodigo ? codigoIncompleto : null) ?? errorServidor;

  // Si el código no sirve, se vuelve a escribirlo a mano con el aviso debajo (también si vino del QR).
  const mostrarErrorDeCodigo = (texto: string) => {
    setErrorServidor(texto);
    setPidiendoNombre(false);
    setModo('manual');
  };

  const mandar = (cod: string, nombrePersona?: string) =>
    vincular.mutate(persona ? { codigo: cod, idPersona: persona.id } : { codigo: cod, nombrePersona }, {
      // Desde Familia se vuelve a Familia, que ya muestra la tarjeta de Eloy. Desde la bienvenida,
      // las personas ya se recargaron: '/' pasa a estar permitida y son las pestañas.
      onSuccess: () => (persona ? router.back() : router.replace('/')),
      onError: (error) => {
        // 404: el backend no distingue un código mal escrito de uno vencido.
        if (error instanceof ErrorApi && error.estado === 404) {
          mostrarErrorDeCodigo('Ese código no existe o ya venció: pedile a Eloy uno nuevo.');
        } else if (error instanceof ErrorApi && error.estado < 500) {
          // 429 (cuánto esperar) y 409 (ese Eloy ya tiene familia): el texto del backend.
          mostrarErrorDeCodigo(error.message);
        } else {
          Alert.alert('No pudimos vincular a Eloy', 'Revisá que el teléfono tenga internet y probá de nuevo.');
        }
      },
    });

  const usarCodigo = (cod: string) => {
    setCodigo(cod);
    setErrorServidor(null);
    if (persona) mandar(cod);
    else setPidiendoNombre(true);
  };

  const leerQr = (texto: string) => {
    const cod = codigoDeTexto(texto).toUpperCase();
    if (!esCodigoVinculacion(cod)) {
      setAvisoQr('Ese código QR no es el de Eloy. Apuntá al que aparece en su pantalla.');
      return;
    }
    setAvisoQr(null);
    usarCodigo(cod);
  };

  const continuarConCodigo = () => {
    setIntentoCodigo(true);
    if (codigoIncompleto || errorServidor) return;
    usarCodigo(codigo);
  };

  const vincularConNombre = () => {
    setIntentoNombre(true);
    if (errorNombre(nombre)) return;
    mandar(codigo, nombre.trim());
  };

  const volver = () => {
    if (pidiendoNombre) setPidiendoNombre(false);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // Desde la bienvenida es la continuación de crear la cuenta: el paso 1 ya está hecho.
  const paso = pidiendoNombre ? 3 : 2;

  return (
    <Pantalla bordes={['top', 'bottom', 'left', 'right']}>
      <View style={estilos.columna}>
        <View style={estilos.encabezado}>
          <View style={estilos.fila}>
            <BotonIcono icono={ChevronLeft} etiqueta="Volver" onPress={volver} />
            {!persona && (
              <>
                <Texto variante="secundario" centrado style={estilos.flex}>
                  Paso {paso} de 3
                </Texto>
                {/* Del mismo ancho que el botón, para que el texto quede centrado. */}
                <View style={estilos.lugarBoton} />
              </>
            )}
          </View>
          {!persona && <Pasos actual={paso} total={3} />}
        </View>

        {pidiendoNombre ? (
          <>
            <Titulo
              titulo="¿Cómo se llama la persona que va a usar Eloy?"
              subtitulo="Así va a aparecer en la app."
            />
            <CampoTexto
              etiqueta="Nombre"
              value={nombre}
              onChangeText={setNombre}
              error={intentoNombre ? errorNombre(nombre) : null}
              placeholder="Por ejemplo: Marta"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={80}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={vincularConNombre}
            />
            <Boton titulo="Vincular" onPress={vincularConNombre} cargando={vincular.isPending} />
          </>
        ) : modo === 'manual' ? (
          <>
            <Titulo
              titulo="Escribí el código"
              subtitulo={`Son las ${LARGO_VINCULACION} letras y números que aparecen en la pantalla de Eloy.`}
            />
            <CampoTexto
              etiqueta="Código"
              codigo
              value={codigo}
              onChangeText={(texto) => {
                setCodigo(limpiarCodigoVinculacion(texto));
                setErrorServidor(null);
              }}
              error={errorCodigo}
              placeholder="K7M4PX"
              // Mayúsculas desde el principio y sin emojis ni autocorrector.
              autoCapitalize="characters"
              keyboardType="ascii-capable"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              maxLength={LARGO_VINCULACION}
              returnKeyType="go"
              onSubmitEditing={continuarConCodigo}
            />
            <Boton
              titulo={persona ? 'Vincular' : 'Continuar'}
              onPress={continuarConCodigo}
              cargando={vincular.isPending}
            />
            <Consejo texto={CONSEJO} />
            <BotonTexto titulo="Usar la cámara" onPress={() => setModo('camara')} />
          </>
        ) : (
          <>
            <Titulo
              titulo="Vinculá a Eloy"
              subtitulo="En la pantalla de Eloy aparece un código. Apuntá la cámara y listo."
            />
            <VisorQr onLeer={leerQr} pausado={vincular.isPending} />
            {avisoQr && (
              <Texto color="textoSecundario" centrado accessibilityLiveRegion="polite">
                {avisoQr}
              </Texto>
            )}
            <Consejo texto={CONSEJO} />
            <View style={estilos.flex} />
            <Boton titulo="Escribir el código a mano" variante="contorno" onPress={() => setModo('manual')} />
          </>
        )}
      </View>
    </Pantalla>
  );
}

function Titulo({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <View style={estilos.titulo}>
      <Texto variante="titulo" accessibilityRole="header">
        {titulo}
      </Texto>
      <Texto color="textoSecundario">{subtitulo}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  columna: { flex: 1, gap: espacio[6] },
  encabezado: { gap: espacio[5] },
  fila: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  lugarBoton: { width: 48 },
  titulo: { gap: espacio[2] },
});
