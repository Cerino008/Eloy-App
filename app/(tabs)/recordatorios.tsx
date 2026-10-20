import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Boton, Pantalla, Texto } from '@/componentes';
import { espacio } from '@/tema';

export default function Recordatorios() {
  const router = useRouter();

  return (
    <Pantalla>
      <View style={estilos.columna}>
        <View>
          <Texto variante="titulo">Recordatorios</Texto>
          <Texto variante="secundario">Acá van a aparecer los recordatorios.</Texto>
        </View>
        <Boton titulo="Agregar recordatorio" icono={Plus} onPress={() => router.push('/nuevo-recordatorio')} />
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: espacio[6] },
});
