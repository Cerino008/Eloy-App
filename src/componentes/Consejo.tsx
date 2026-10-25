import { Info } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colores, espacio } from '@/tema';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';

// Una ayuda corta, con la "i" en teal.
export function Consejo({ texto }: { texto: string }) {
  return (
    <Tarjeta>
      <View style={estilos.fila}>
        <Info size={24} color={colores.teal} strokeWidth={2} />
        <Texto color="textoSecundario" style={estilos.texto}>
          {texto}
        </Texto>
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacio[3],
  },
  texto: { flex: 1 },
});
