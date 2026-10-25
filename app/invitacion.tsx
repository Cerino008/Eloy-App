import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ErrorApi } from '@/api/errores';
import { useAceptarInvitacion } from '@/api/useAceptarInvitacion';
import { Boton, BotonVolver, CampoTexto, Consejo, Pantalla, Texto } from '@/componentes';
import { codigoDeTexto, LARGO_MINIMO_INVITACION } from '@/codigos';
import { espacio } from '@/tema';

function errorInvitacion(codigo: string): string | null {
  if (!codigo) return 'Pegá el link o el código de la invitación.';
  if (codigo.length < LARGO_MINIMO_INVITACION) return 'Ese código está incompleto: copiá el link entero que te mandaron.';
  return null;
}

// Se puede abrir con el código ya cargado: /invitacion?codigo=… (para cuando el link de la invitación abra la app).
export default function Invitacion() {
  const { codigo: codigoDeRuta } = useLocalSearchParams<{ codigo?: string }>();
  const aceptar = useAceptarInvitacion();

  const [texto, setTexto] = useState(codigoDeRuta ?? '');
  const [intento, setIntento] = useState(false);
  // Lo que respondió el servidor (ej. "La invitación no existe, ya se usó o venció"); se borra al cambiar el texto.
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  // Del link pegado (o del mensaje entero de WhatsApp) solo interesa el código.
  const codigo = codigoDeTexto(texto);
  const error = (intento ? errorInvitacion(codigo) : null) ?? errorServidor;

  const unirme = () => {
    setIntento(true);
    if (errorInvitacion(codigo) || errorServidor) return;
    // Si sale bien no hace falta navegar: con la persona nueva, el flujo de entrada lleva a las pestañas.
    aceptar.mutate(codigo, {
      onError: (falla) => {
        if (falla instanceof ErrorApi && falla.estado < 500) setErrorServidor(falla.message);
        else Alert.alert('No pudimos sumarte a la familia', 'Revisá que el teléfono tenga internet y probá de nuevo.');
      },
    });
  };

  return (
    <Pantalla bordes={['top', 'bottom', 'left', 'right']}>
      <View style={estilos.columna}>
        <BotonVolver />
        <View style={estilos.titulo}>
          <Texto variante="titulo" accessibilityRole="header">
            Entrá con tu invitación
          </Texto>
          <Texto color="textoSecundario">
            Pegá el link que te mandó tu familiar. Si solo tenés el código, también sirve.
          </Texto>
        </View>

        <CampoTexto
          etiqueta="Link o código"
          value={texto}
          onChangeText={(nuevo) => {
            setTexto(nuevo);
            setErrorServidor(null);
          }}
          error={error}
          placeholder="https://eloy.app/invitacion?codigo=…"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          multiline
          // Con multiline, el botón del teclado envía en vez de agregar un renglón.
          submitBehavior="blurAndSubmit"
          returnKeyType="go"
          onSubmitEditing={unirme}
        />

        <Boton titulo="Unirme" onPress={unirme} cargando={aceptar.isPending} />

        <Consejo texto="Para pegar, mantené el dedo apoyado en el campo y tocá “Pegar”." />
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: espacio[6] },
  titulo: { gap: espacio[2] },
});
