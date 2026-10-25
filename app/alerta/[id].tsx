import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Phone, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { consultas } from '@/api/consultas';
import { ErrorApi, esConflicto } from '@/api/errores';
import type { Alerta } from '@/api/tipos';
import { useAtenderAlerta } from '@/api/useAtenderAlerta';
import {
  Boton,
  BotonVolver,
  Cargando,
  ErrorAlCargar,
  Pantalla,
  ReproductorAudio,
  Tarjeta,
  Texto,
} from '@/componentes';
import { cuandoFue, haceCuanto } from '@/fechas';
import { colores, espacio } from '@/tema';
import { capitalizar, enumerar } from '@/textos';
import { useAhora } from '@/useAhora';

const AVISO_SIN_INTERNET = 'Revisá que el teléfono tenga internet y probá de nuevo.';

// Cuando no hay nada que mostrar de lo que dijo: cómo pidió ayuda.
const COMO_PIDIO: Record<Alerta['origen'], string> = {
  voz: 'Se lo pidió a Eloy en voz alta.',
  pulsera: 'Apretó el botón de la pulsera.',
  pantalla: 'Tocó el botón de ayuda en la pantalla de Eloy.',
};

// null mientras está abierta: todavía nadie se ocupa.
function quienSeOcupa(alerta: Alerta): string | null {
  const quien = alerta.atendidaPor;
  switch (alerta.estado) {
    case 'abierta':
      return null;
    case 'atendida':
      if (alerta.atendidaPorMi) return 'Vos te estás ocupando.';
      return quien ? `${quien} ya se está ocupando.` : 'Alguien de la familia ya se está ocupando.';
    case 'cerrada':
      if (alerta.atendidaPorMi) return 'Vos te ocupaste. La alerta ya se cerró.';
      return quien ? `${quien} se ocupó. La alerta ya se cerró.` : 'La alerta ya se cerró.';
  }
}

export default function PantallaAlerta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const alerta = useQuery(consultas.alerta(Number(id)));
  const noExiste = alerta.error instanceof ErrorApi && alerta.error.estado === 404;

  return (
    <Pantalla fondo="alerta" bordes={['top', 'bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={estilos.contenido}>
        <View style={estilos.encabezado}>
          <View style={estilos.marca}>
            <TriangleAlert size={28} color={colores.textoSobreOscuro} strokeWidth={2} />
            <Texto variante="etiqueta" color="textoSobreOscuro" accessibilityRole="header">
              Alerta
            </Texto>
          </View>
          <BotonVolver cerrar />
        </View>

        {alerta.isPending ? (
          <Cargando sobreAlerta />
        ) : noExiste ? (
          <Texto color="textoSobreOscuro">No encontramos esta alerta. Puede que ya se haya cerrado.</Texto>
        ) : alerta.isError ? (
          <ErrorAlCargar
            sobreAlerta
            titulo="No pudimos traer la alerta"
            onReintentar={() => alerta.refetch()}
            reintentando={alerta.isFetching}
          />
        ) : (
          <Detalle alerta={alerta.data} />
        )}
      </View>
    </Pantalla>
  );
}

function Detalle({ alerta }: { alerta: Alerta }) {
  const router = useRouter();
  const atender = useAtenderAlerta(alerta.id);
  // El detalle del 409 ("Vero ya se está ocupando"), hasta que llegue la alerta actualizada.
  const [ocupadoPor, setOcupadoPor] = useState<string | null>(null);
  const ahora = useAhora(30_000);

  const hace = haceCuanto(alerta.ocurridaEn, ahora);
  const cuando = `${capitalizar(cuandoFue(alerta.ocurridaEn, ahora))}${hace ? ` · ${hace}` : ''}`;
  const hayLoQueDijo = alerta.motivo !== null || alerta.audioUrl !== null;
  const avisados = enumerar(
    alerta.tambienAvisamosA.map(({ nombre, parentesco }) => (parentesco ? `${nombre} (${parentesco})` : nombre)),
  );
  const seOcupa = quienSeOcupa(alerta) ?? (ocupadoPor ? `${ocupadoPor}.` : null);
  const telefono = alerta.telefonoPersona;

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const llamar = (numero: string) =>
    Linking.openURL(`tel:${numero.replace(/[^\d+]/g, '')}`).catch(() =>
      Alert.alert('No se pudo abrir el teléfono', `Probá llamar al ${numero}.`),
    );

  const meOcupo = () =>
    atender.mutate(undefined, {
      onSuccess: volver,
      onError: (error) => {
        if (esConflicto(error)) setOcupadoPor(error.message);
        else Alert.alert('No pudimos avisar que te ocupás', AVISO_SIN_INTERNET);
      },
    });

  return (
    <>
      <View style={estilos.bloque}>
        <Texto variante="tituloGrande" color="textoSobreOscuro">
          {alerta.persona} pidió ayuda
        </Texto>
        <Texto color="textoSobreOscuro">{cuando}</Texto>
        <Texto color="textoSobreOscuro">
          {hayLoQueDijo ? `${alerta.persona} le dijo a Eloy:` : COMO_PIDIO[alerta.origen]}
        </Texto>
      </View>

      {hayLoQueDijo && (
        <Tarjeta style={estilos.bloque}>
          {alerta.motivo && <Texto variante="subtitulo">“{alerta.motivo}”</Texto>}
          {alerta.audioUrl && <ReproductorAudio variante="alerta" duracionSeg={alerta.audioDuracionSeg ?? 0} />}
        </Tarjeta>
      )}

      {avisados !== '' && (
        <Tarjeta fondo="alertaOscuro">
          <Texto variante="cuerpoFuerte" color="textoSobreOscuro">
            También avisamos a
          </Texto>
          <Texto color="textoSobreOscuro">{avisados}</Texto>
        </Tarjeta>
      )}

      {/* Empuja los botones abajo de todo, como en el diseño. */}
      <View style={estilos.espacio} />

      {seOcupa ? (
        <View style={estilos.bloque}>
          <Tarjeta fondo="alertaOscuro">
            <Texto variante="subtitulo" color="textoSobreOscuro" accessibilityLiveRegion="polite">
              {seOcupa}
            </Texto>
          </Tarjeta>
          <Boton titulo="Volver" variante="alertaClaro" onPress={volver} />
        </View>
      ) : (
        <View style={estilos.bloque}>
          {telefono && (
            <Boton
              titulo={`Llamar a ${alerta.persona}`}
              icono={Phone}
              variante="alertaClaro"
              onPress={() => llamar(telefono)}
            />
          )}
          <Boton titulo="Ya me ocupo yo" variante="alertaContorno" onPress={meOcupo} cargando={atender.isPending} />
          <Texto variante="chica" color="textoSobreOscuro" centrado>
            Al tocar “Ya me ocupo yo”, el resto de la familia lo ve
          </Texto>
        </View>
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, gap: espacio[5] },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
  },
  bloque: { gap: espacio[3] },
  espacio: { flexGrow: 1 },
});
