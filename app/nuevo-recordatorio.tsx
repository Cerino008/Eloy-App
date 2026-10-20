import { StyleSheet, View } from 'react-native';

import { BotonVolver, Pantalla, Texto } from '@/componentes';
import { espacio } from '@/tema';

export default function NuevoRecordatorio() {
  return (
    <Pantalla bordes={['bottom', 'left', 'right']}>
      <View style={estilos.encabezado}>
        <Texto variante="titulo">Nuevo recordatorio</Texto>
        <BotonVolver cerrar />
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio[3],
    paddingTop: espacio[2],
  },
});
