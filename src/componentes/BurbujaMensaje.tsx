import { StyleSheet, View } from 'react-native';

import type { Mensaje } from '@/api/tipos';
import { colores, espacio, fuentes, radio } from '@/tema';
import { ReproductorAudio } from './ReproductorAudio';
import { Texto } from './Texto';

type Props = {
  mensaje: Mensaje;
  // La línea de abajo: "Marta, por Eloy · 10:45", "Eloy ya se lo leyó · 11:20"...
  pie: string;
  // En teal, para "Eloy ya se lo leyó".
  pieDestacado?: boolean;
};

// Lo que manda la persona va a la izquierda en blanco; lo de la familia, a la derecha en azul.
export function BurbujaMensaje({ mensaje, pie, pieDestacado }: Props) {
  const deFamilia = mensaje.direccion === 'de_familia';

  return (
    <View style={[estilos.base, deFamilia ? estilos.derecha : estilos.izquierda]}>
      <View style={[estilos.burbuja, deFamilia ? estilos.burbujaFamilia : estilos.burbujaPersona]}>
        {mensaje.texto !== null && <Texto color={deFamilia ? 'textoSobreOscuro' : 'texto'}>{mensaje.texto}</Texto>}
        {mensaje.audioUrl !== null && <ReproductorAudio duracionSeg={mensaje.audioDuracionSeg ?? 0} />}
      </View>
      <Texto
        variante="secundario"
        color={pieDestacado ? 'tealTexto' : 'textoSecundario'}
        style={[estilos.pie, pieDestacado && estilos.pieDestacado, deFamilia && estilos.pieDerecha]}
      >
        {pie}
      </Texto>
    </View>
  );
}

// La esquina del lado de quien escribe va casi recta, como en el diseño.
const ESQUINA_CHICA = 4;

const estilos = StyleSheet.create({
  base: {
    maxWidth: '80%',
    gap: espacio[1],
  },
  izquierda: { alignSelf: 'flex-start' },
  derecha: { alignSelf: 'flex-end' },
  burbuja: {
    borderRadius: radio.tarjeta,
    paddingHorizontal: espacio[4],
    paddingVertical: espacio[3],
    gap: espacio[3],
  },
  burbujaPersona: {
    backgroundColor: colores.superficie,
    borderBottomLeftRadius: ESQUINA_CHICA,
  },
  burbujaFamilia: {
    backgroundColor: colores.texto,
    borderBottomRightRadius: ESQUINA_CHICA,
  },
  pie: { paddingHorizontal: espacio[1] },
  pieDerecha: { textAlign: 'right' },
  pieDestacado: { fontFamily: fuentes.semi },
});
