import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  type FlatListInstance,
} from 'react-native';

import { consultas } from '@/api/consultas';
import type { Mensaje } from '@/api/tipos';
import { useEnviarMensaje } from '@/api/useEnviarMensaje';
import {
  Avatar,
  BurbujaMensaje,
  CampoMensaje,
  Cargando,
  Chip,
  ErrorAlCargar,
  Pantalla,
  Texto,
} from '@/componentes';
import { hora, nombreDelDia } from '@/fechas';
import { colores, espacio, margenPantalla } from '@/tema';

type Fila = { tipo: 'dia'; clave: string; texto: string } | { tipo: 'mensaje'; clave: string; mensaje: Mensaje };

// La lista está invertida (el primer elemento queda abajo), así que va del más nuevo al más viejo
// y cada separador de día va después de los mensajes de ese día.
function armarFilas(mensajes: Mensaje[]): Fila[] {
  const nuevosPrimero = [...mensajes].reverse();
  const filas: Fila[] = [];

  nuevosPrimero.forEach((mensaje, i) => {
    filas.push({ tipo: 'mensaje', clave: `mensaje-${mensaje.id}`, mensaje });
    const dia = nombreDelDia(mensaje.creadoEn);
    const anterior = nuevosPrimero[i + 1];
    if (!anterior || nombreDelDia(anterior.creadoEn) !== dia) {
      filas.push({ tipo: 'dia', clave: `dia-${dia}`, texto: dia });
    }
  });

  return filas;
}

function estadoDeLectura(mensaje: Mensaje): string {
  switch (mensaje.estado) {
    case 'pendiente':
    case 'entregado':
      return 'Eloy se lo lee en un momento';
    case 'leido':
      return mensaje.leidoEn ? `Eloy ya se lo leyó · ${hora(mensaje.leidoEn)}` : 'Eloy ya se lo leyó';
  }
}

// Los míos no llevan nombre; los de otros familiares, sí. Los ya leídos van destacados.
function pieDe(mensaje: Mensaje, yoId: number | undefined): { texto: string; destacado: boolean } {
  if (mensaje.direccion === 'a_familia') {
    return { texto: `${mensaje.de}, por Eloy · ${hora(mensaje.creadoEn)}`, destacado: false };
  }
  const estado = estadoDeLectura(mensaje);
  return {
    texto: mensaje.deFamiliarId === yoId ? estado : `${mensaje.de} · ${estado}`,
    destacado: mensaje.estado === 'leido',
  };
}

export default function Mensajes() {
  const mensajes = useQuery(consultas.mensajes);
  const yo = useQuery(consultas.yo);
  const hoy = useQuery(consultas.hoy);
  const nombre = hoy.data?.persona.nombre;

  const [texto, setTexto] = useState('');
  // Tipo de instancia, como pide la API estricta de React Native 0.88; solo se usa para scrollToOffset.
  const lista = useRef<FlatListInstance>(null);

  const enviar = useEnviarMensaje((textoNoEnviado) => {
    // Si ya empezó a escribir otra cosa, no se la pisamos.
    setTexto((actual) => (actual.trim() ? actual : textoNoEnviado));
    Alert.alert('No se pudo mandar el mensaje', 'Revisá que el teléfono tenga internet y probá de nuevo.');
  });

  const filas = useMemo(() => armarFilas(mensajes.data ?? []), [mensajes.data]);

  const mandar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    setTexto('');
    enviar.mutate(limpio);
    // Invertida: el offset 0 es el final de la charla.
    lista.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const renderFila = ({ item }: { item: Fila }) => {
    if (item.tipo === 'dia') {
      return (
        <View style={estilos.dia}>
          <Chip texto={item.texto} />
        </View>
      );
    }
    const pie = pieDe(item.mensaje, yo.data?.id);
    return <BurbujaMensaje mensaje={item.mensaje} pie={pie.texto} pieDestacado={pie.destacado} />;
  };

  return (
    <Pantalla scroll={false} relleno={false}>
      <KeyboardAvoidingView style={estilos.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={estilos.encabezado}>
          {nombre && <Avatar nombre={nombre} variante="persona" tamano={48} />}
          <View style={estilos.flex}>
            <Texto variante="subtitulo" accessibilityRole="header">
              {nombre ?? 'Mensajes'}
            </Texto>
            <Texto variante="secundario">Eloy le lee en voz alta lo que escribas</Texto>
          </View>
        </View>

        {mensajes.isPending ? (
          <Cargando />
        ) : mensajes.isError ? (
          <View style={estilos.error}>
            <ErrorAlCargar
              titulo="No pudimos traer los mensajes"
              onReintentar={() => mensajes.refetch()}
              reintentando={mensajes.isFetching}
            />
          </View>
        ) : (
          <>
            {filas.length === 0 ? (
              <View style={estilos.vacio}>
                <Texto color="textoSecundario" centrado>
                  Todavía no hay mensajes. Escribí algo y Eloy se lo lee{nombre ? ` a ${nombre}` : ''}.
                </Texto>
              </View>
            ) : (
              <FlatList
                ref={lista}
                inverted
                data={filas}
                keyExtractor={(fila) => fila.clave}
                renderItem={renderFila}
                contentContainerStyle={estilos.lista}
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
              />
            )}
            <CampoMensaje
              valor={texto}
              onCambiar={setTexto}
              onEnviar={mandar}
              placeholder={nombre ? `Escribile a ${nombre}…` : 'Escribí un mensaje…'}
            />
          </>
        )}
      </KeyboardAvoidingView>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[4],
    paddingHorizontal: margenPantalla,
    paddingTop: espacio[2],
    paddingBottom: espacio[4],
    borderBottomWidth: 1,
    borderBottomColor: colores.separador,
  },
  lista: {
    paddingHorizontal: espacio[4],
    paddingVertical: espacio[4],
    gap: espacio[5],
  },
  dia: { flexDirection: 'row', justifyContent: 'center' },
  error: { padding: margenPantalla },
  vacio: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: margenPantalla,
  },
});
