import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorApi } from '@/api/errores';
import { colores } from '@/tema';

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
  // Las respuestas 4xx (404, 409...) no se reintentan: la respuesta no va a cambiar.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (fallas, error) => !(error instanceof ErrorApi && error.estado < 500) && fallas < 1,
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
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="alerta/[id]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="vincular" />
            <Stack.Screen name="nuevo-recordatorio" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
