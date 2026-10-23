import { StyleSheet, View } from 'react-native';

import type { Familiar } from '@/api/tipos';
import { espacio } from '@/tema';
import { Avatar } from './Avatar';
import { Texto } from './Texto';

type Props = {
  familiar: Familiar;
  esYo: boolean;
};

// "Hija · Orden de aviso: 1", "Hijo · Administrador · Orden de aviso: 2".
function detalleDe(familiar: Familiar): string {
  return [
    familiar.parentesco,
    familiar.rol === 'administrador' ? 'Administrador' : null,
    // Con espacios que no se cortan: la frase baja entera a la línea de abajo, nunca partida.
    familiar.prioridadAlerta !== null ? `Orden de aviso: ${familiar.prioridadAlerta}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function FilaFamiliar({ familiar, esYo }: Props) {
  const nombre = esYo ? `${familiar.nombre} (vos)` : familiar.nombre;
  const detalle = detalleDe(familiar);
  const sinCuenta = familiar.tieneCuenta ? null : 'Todavía no entró a la app';

  return (
    <View style={estilos.fila} accessible accessibilityLabel={[nombre, detalle, sinCuenta].filter(Boolean).join(', ')}>
      <Avatar nombre={familiar.nombre} variante={esYo ? 'yo' : 'familiar'} />
      <View style={estilos.textos}>
        <Texto variante="cuerpoFuerte">{nombre}</Texto>
        {detalle !== '' && <Texto variante="secundario">{detalle}</Texto>}
        {sinCuenta && <Texto variante="secundario">{sinCuenta}</Texto>}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[4],
    paddingVertical: espacio[4],
  },
  textos: { flex: 1 },
});
