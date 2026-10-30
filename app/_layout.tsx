import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { consultas } from '@/api/consultas';
import { esRespuestaDelServidor } from '@/api/errores';
import { BotonTexto, Cargando, ErrorAlCargar, Pantalla } from '@/componentes';
import { SesionProvider, useSesion } from '@/sesion';
import { colores, espacio } from '@/tema';

SplashScreen.preventAutoHideAsync();

// Si se entra directo a un modal o a una alerta (por ejemplo, desde una notificación), las pestañas quedan debajo.
export const unstable_settings = { anchor: '(tabs)' };

// La app es siempre clara, aunque el teléfono esté en modo oscuro.
const temaNavegacion: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: colores.accion,
    background: colores.fondo,
    card: colores.superficie,
    text: colores.texto,
    border: colores.separador,
  },
};

export default function RootLayout() {
  const [fuentesCargadas, errorFuentes] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // Un solo reintento: con los 3 de fábrica el error tarda varios segundos en aparecer.
  // Las respuestas 4xx (404, 409...) no se reintentan: la respuesta no va a cambiar. Sin conexión, sí.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (fallas, error) => !esRespuestaDelServidor(error) && fallas < 1,
          },
        },
      }),
  );

  // Si la fuente falla seguimos con la del sistema antes que dejar la app trabada.
  const listo = fuentesCargadas || errorFuentes !== null;

  useEffect(() => {
    if (listo) SplashScreen.hideAsync();
  }, [listo]);

  if (!listo) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider value={temaNavegacion}>
          <StatusBar style="dark" />
          <SesionProvider>
            <Navegacion />
          </SesionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

// Qué pantallas se pueden abrir según la sesión. Si la que está abierta deja de estar permitida
// (ej. al cerrar sesión o al crear la cuenta), Expo Router lleva a `inicio`.
function Navegacion() {
  const { estado, salir } = useSesion();
  const conSesion = estado === 'con_sesion';
  const personas = useQuery({ ...consultas.personas, enabled: conSesion });

  if (estado === 'cargando' || (conSesion && personas.isPending)) {
    return (
      <Pantalla scroll={false} bordes={['top', 'bottom', 'left', 'right']}>
        <Cargando />
      </Pantalla>
    );
  }

  // Solo si nunca llegaron: si falla una recarga, se sigue con las que ya había.
  if (conSesion && personas.isError && !personas.data) {
    return (
      <Pantalla bordes={['top', 'bottom', 'left', 'right']}>
        <View style={estilos.error}>
          <ErrorAlCargar onReintentar={() => personas.refetch()} reintentando={personas.isFetching} />
          <BotonTexto titulo="Cerrar sesión" onPress={salir} />
        </View>
      </Pantalla>
    );
  }

  const conPersonas = conSesion && (personas.data?.length ?? 0) > 0;
  // Hay que decirlo: si no, Expo Router elige la primera ruta permitida según su propio orden
  // (no el de abajo), y después del registro abría Vincular en vez de la bienvenida.
  const inicio = !conSesion ? '/login' : conPersonas ? '/' : '/bienvenida';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }}>
      <Stack.Protected guard={!conSesion} redirectTo={inicio}>
        <Stack.Screen name="login" />
        <Stack.Screen name="registro" />
      </Stack.Protected>

      {/* Con cuenta pero sin seguir a nadie todavía. */}
      <Stack.Protected guard={conSesion && !conPersonas} redirectTo={inicio}>
        <Stack.Screen name="bienvenida" />
        <Stack.Screen name="invitacion" />
      </Stack.Protected>

      <Stack.Protected guard={conPersonas} redirectTo={inicio}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="alerta/[id]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="nuevo-recordatorio" options={{ presentation: 'modal' }} />
      </Stack.Protected>

      {/* Desde la bienvenida y desde Familia. */}
      <Stack.Protected guard={conSesion} redirectTo={inicio}>
        <Stack.Screen name="vincular" />
      </Stack.Protected>
    </Stack>
  );
}

const estilos = StyleSheet.create({
  error: { gap: espacio[4], paddingTop: espacio[8] },
});
