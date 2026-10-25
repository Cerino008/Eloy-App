import { StyleSheet, View } from 'react-native';

import type { Familiar } from '@/api/tipos';
import { espacio } from '@/tema';
import { Avatar } from './Avatar';
import { Texto } from './Texto';

type Props = {
  familiar: Familiar;
};

// En qué orden lo avisan si hay una alerta; si no recibe alertas, eso (aunque tenga un número).
// Con espacios que no se cortan: la frase baja entera a la línea de abajo, nunca partida.
function avisoDe(familiar: Familiar): string | null {
  if (!familiar.recibeAlertas) return 'No recibe alertas';
  return familiar.prioridadAlerta !== null ? `Orden de aviso: ${familiar.prioridadAlerta}` : null;
}

// "Hija · Orden de aviso: 1", "Hijo · Administrador · Orden de aviso: 2", "Nieto · No recibe alertas".
function detalleDe(familiar: Familiar): string {
  return [familiar.parentesco, familiar.rol === 'administrador' ? 'Administrador' : null, avisoDe(familiar)]
    .filter(Boolean)
    .join(' · ');
}

export function FilaFamiliar({ familiar }: Props) {
  const esYo = familiar.soyYo;
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
