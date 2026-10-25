import { StyleSheet, View } from 'react-native';

import { BotonVolver, Pantalla, Texto } from '@/componentes';
import { espacio } from '@/tema';

export default function Invitacion() {
  return (
    <Pantalla bordes={['top', 'bottom', 'left', 'right']}>
      <View style={estilos.columna}>
        <BotonVolver />
        <View>
          <Texto variante="titulo">Entrá con tu invitación</Texto>
          <Texto variante="secundario">Abrí el link que te mandó tu familiar o escribí el código.</Texto>
        </View>
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: espacio[6] },
});
