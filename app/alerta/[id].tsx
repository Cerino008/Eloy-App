import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { BotonVolver, Pantalla, Texto } from '@/componentes';
import { espacio } from '@/tema';

export default function Alerta() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Pantalla fondo="alerta" scroll={false} bordes={['top', 'bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={estilos.columna}>
        <BotonVolver />
        <View>
          <Texto variante="tituloGrande" color="textoSobreOscuro">
            Alerta
          </Texto>
          <Texto variante="secundario" color="textoSobreOscuro">
            Alerta n.º {id}
          </Texto>
        </View>
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: espacio[6] },
});
