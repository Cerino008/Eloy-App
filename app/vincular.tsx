import { StyleSheet, View } from 'react-native';

import { BotonVolver, Pantalla, Texto } from '@/componentes';
import { espacio } from '@/tema';

export default function Vincular() {
  return (
    <Pantalla bordes={['top', 'bottom', 'left', 'right']}>
      <View style={estilos.columna}>
        <BotonVolver />
        <View>
          <Texto variante="titulo">Vinculá a Eloy</Texto>
          <Texto variante="secundario">En la pantalla de Eloy aparece un código. Apuntá la cámara y listo.</Texto>
        </View>
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: espacio[6] },
});
