import { StyleSheet } from 'react-native';

import { fuentes } from '@/tema';
import { Texto } from './Texto';

// "ELOY" con la O naranja, como en el diseño.
export function Logo() {
  return (
    <Texto style={estilos.logo} accessibilityRole="header" accessibilityLabel="Eloy">
      EL<Texto color="accionOscuro" style={estilos.logo}>O</Texto>Y
    </Texto>
  );
}

const estilos = StyleSheet.create({
  logo: {
    fontFamily: fuentes.extra,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 6,
  },
});
