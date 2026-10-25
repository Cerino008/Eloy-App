import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { consultas } from '@/api/consultas';
import { Boton, BotonTexto, Logo, Pantalla, Tarjeta, Texto } from '@/componentes';
import { useSesion } from '@/sesion';
import { espacio } from '@/tema';

// Con sesión pero sin seguir a nadie todavía (ej. una cuenta recién creada).
export default function Bienvenida() {
  const router = useRouter();
  const { salir } = useSesion();
  const nombre = useQuery(consultas.usuario).data?.nombre;
  const [saliendo, setSaliendo] = useState(false);

  const cerrarSesion = () => {
    setSaliendo(true);
    salir();
  };

  return (
    <Pantalla bordes={['top', 'bottom', 'left', 'right']}>
      <View style={estilos.columna}>
        <Logo />
        <View style={estilos.titulo}>
          <Texto variante="titulo" accessibilityRole="header">
            {nombre ? `Hola, ${nombre}` : 'Hola'}
          </Texto>
          <Texto color="textoSecundario">Para empezar, conectá la app con el Eloy de tu familia.</Texto>
        </View>

        <Tarjeta style={estilos.tarjeta}>
          <Texto variante="cuerpoFuerte">¿Eloy es nuevo?</Texto>
          <Texto variante="secundario">Vinculalo con el código que aparece en su pantalla.</Texto>
        </Tarjeta>
        <Tarjeta style={estilos.tarjeta}>
          <Texto variante="cuerpoFuerte">¿Alguien de la familia ya lo usa?</Texto>
          <Texto variante="secundario">Pedile que te invite y entrá con el link que te mande.</Texto>
        </Tarjeta>

        <View style={estilos.botones}>
          <Boton titulo="Vincular a Eloy" onPress={() => router.push('/vincular')} />
          <Boton titulo="Tengo una invitación" variante="contorno" onPress={() => router.push('/invitacion')} />
        </View>

        <BotonTexto titulo="Cerrar sesión" onPress={cerrarSesion} deshabilitado={saliendo} />
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: espacio[6], paddingTop: espacio[4] },
  titulo: { gap: espacio[2] },
  tarjeta: { gap: espacio[1] },
  botones: { gap: espacio[3] },
});
