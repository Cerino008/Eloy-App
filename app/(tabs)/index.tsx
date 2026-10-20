import { useRouter } from 'expo-router';
import { MessageSquare, Settings } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Boton, BotonIcono, Pantalla, Texto } from '@/componentes';
import { espacio } from '@/tema';

export default function Inicio() {
  const router = useRouter();

  return (
    <Pantalla>
      <View style={estilos.columna}>
        <View style={estilos.encabezado}>
          <Texto variante="titulo">Inicio</Texto>
          <BotonIcono icono={Settings} etiqueta="Ajustes de la familia" onPress={() => router.navigate('/familia')} />
        </View>

        <Boton titulo="Mandarle un mensaje" icono={MessageSquare} onPress={() => router.navigate('/mensajes')} />

        {/* TEMPORAL: accesos para probar pantallas que todavía no tienen otra entrada. */}
        <View style={estilos.prueba}>
          <Texto variante="etiqueta">Para probar</Texto>
          <Boton titulo="Ver una alerta" variante="peligro" onPress={() => router.push('/alerta/1')} />
          <Boton titulo="Vincular a Eloy" variante="contorno" onPress={() => router.push('/vincular')} />
        </View>
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: espacio[6] },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prueba: { gap: espacio[3], marginTop: espacio[8] },
});
