import { Tabs } from 'expo-router/js-tabs';
import { House, MessageSquare, Timer, Users, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Texto } from '@/componentes';
import { colores, espacio, fuentes } from '@/tema';

const ALTO_BARRA = 64;

// La pestaña activa: ícono naranja y texto en negrita.
function icono(Icono: LucideIcon) {
  return ({ focused }: { focused: boolean }) => (
    <Icono size={26} strokeWidth={2} color={focused ? colores.accion : colores.textoSecundario} />
  );
}

function etiqueta({ focused, children }: { focused: boolean; children: string }) {
  return (
    <Texto
      variante="secundario"
      color={focused ? 'texto' : 'textoSecundario'}
      style={{ fontFamily: focused ? fuentes.bold : fuentes.regular }}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.87}
      maxFontSizeMultiplier={1.2}
    >
      {children}
    </Texto>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarLabel: etiqueta,
        tabBarStyle: {
          backgroundColor: colores.superficie,
          borderTopColor: colores.separador,
          borderTopWidth: 1,
          height: ALTO_BARRA + insets.bottom,
          paddingTop: espacio[2],
        },
        tabBarItemStyle: { gap: espacio[1] },
        sceneStyle: { backgroundColor: colores.fondo },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icono(House) }} />
      <Tabs.Screen name="mensajes" options={{ title: 'Mensajes', tabBarIcon: icono(MessageSquare) }} />
      <Tabs.Screen name="recordatorios" options={{ title: 'Recordatorios', tabBarIcon: icono(Timer) }} />
      <Tabs.Screen name="familia" options={{ title: 'Familia', tabBarIcon: icono(Users) }} />
    </Tabs>
  );
}
