import { StyleSheet, View } from 'react-native';

import { espacio } from '@/tema';
import { Boton } from './Boton';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';

type Props = {
  onReintentar: () => void;
  reintentando?: boolean;
  titulo?: string;
};

// Usa el botón naranja: va en lugar del contenido, así que es el único de la pantalla.
export function ErrorAlCargar({ onReintentar, reintentando, titulo = 'No pudimos traer las novedades' }: Props) {
  return (
    <View style={estilos.base}>
      <Tarjeta style={estilos.tarjeta}>
        <Texto variante="cuerpoFuerte">{titulo}</Texto>
        <Texto variante="secundario">Revisá que el teléfono tenga internet y probá de nuevo.</Texto>
      </Tarjeta>
      <Boton titulo="Reintentar" onPress={onReintentar} cargando={reintentando} />
    </View>
  );
}

const estilos = StyleSheet.create({
  base: { gap: espacio[4] },
  tarjeta: { gap: espacio[1] },
});
