import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { api } from '@/api/cliente';
import { consultas } from '@/api/consultas';
import type { Dispositivo, Familiar, Yo } from '@/api/tipos';
import { useCambiarVolumen } from '@/api/useCambiarVolumen';
import { useRestaurarFabrica } from '@/api/useRestaurarFabrica';
import {
  Boton,
  Cargando,
  ErrorAlCargar,
  FilaFamiliar,
  Pantalla,
  Separador,
  Tarjeta,
  TarjetaEloy,
  Texto,
} from '@/componentes';
import { useSesion } from '@/sesion';
import { espacio } from '@/tema';

const AVISO_SIN_INTERNET = 'Revisá que el teléfono tenga internet y probá de nuevo.';

// Primero vos; después por orden de aviso (los que no reciben alertas, al final); a igual orden, por nombre.
function ordenar(familiares: Familiar[], yoId: number): Familiar[] {
  return [...familiares].sort((a, b) => {
    if (a.id === yoId) return -1;
    if (b.id === yoId) return 1;
    const orden = (a.prioridadAlerta ?? Infinity) - (b.prioridadAlerta ?? Infinity);
    return orden !== 0 ? orden : a.nombre.localeCompare(b.nombre);
  });
}

export default function Familia() {
  const familiares = useQuery(consultas.familiares);
  const dispositivo = useQuery(consultas.dispositivo);
  const yo = useQuery(consultas.yo);
  const consultasDeLaPantalla = [familiares, dispositivo, yo];

  return (
    <Pantalla>
      <View style={estilos.columna}>
        <Texto variante="titulo" accessibilityRole="header">
          Familia
        </Texto>

        {familiares.isPending || dispositivo.isPending || yo.isPending ? (
          <Cargando />
        ) : familiares.isError || dispositivo.isError || yo.isError ? (
          <ErrorAlCargar
            onReintentar={() => consultasDeLaPantalla.forEach((consulta) => consulta.refetch())}
            reintentando={consultasDeLaPantalla.some((consulta) => consulta.isFetching)}
          />
        ) : (
          <Contenido familiares={familiares.data} yo={yo.data} dispositivo={dispositivo.data} />
        )}

        <CerrarSesion />
      </View>
    </Pantalla>
  );
}

function Contenido({
  familiares,
  yo,
  dispositivo,
}: {
  familiares: Familiar[];
  yo: Yo;
  dispositivo: Dispositivo | null;
}) {
  const nombre = useQuery(consultas.hoy).data?.persona.nombre;
  const miId = yo.persona.idMiFamiliar;
  const esAdministrador = yo.persona.miRol === 'administrador';
  const administrador = familiares.find((familiar) => familiar.rol === 'administrador');
  const nombreAdministrador = administrador?.nombre ?? 'quien administra la familia';

  const invitar = useMutation({
    mutationFn: api.invitarFamiliar,
    // El código ya viaja en el link; va también aparte por si la app se lo pide.
    onSuccess: ({ link, codigo }) =>
      Share.share({
        message:
          `Te invito a la app de Eloy${nombre ? ` para estar cerca de ${nombre}` : ''}. ` +
          `Entrá desde este link: ${link}\n\nSi te pide un código: ${codigo}`,
      }),
    onError: () => Alert.alert('No pudimos crear la invitación', AVISO_SIN_INTERNET),
  });

  return (
    <>
      <View style={estilos.seccion}>
        <Tarjeta lista>
          {ordenar(familiares, miId).map((familiar, i) => (
            <Fragment key={familiar.id}>
              {i > 0 && <Separador />}
              <FilaFamiliar familiar={familiar} esYo={familiar.id === miId} />
            </Fragment>
          ))}
        </Tarjeta>
        {esAdministrador ? (
          <Boton titulo="Invitar a un familiar" onPress={() => invitar.mutate()} cargando={invitar.isPending} />
        ) : (
          <Texto color="textoSecundario" centrado>
            Pedile a {nombreAdministrador} que invite a alguien.
          </Texto>
        )}
      </View>

      <SeccionEloy
        nombre={nombre}
        dispositivo={dispositivo}
        esAdministrador={esAdministrador}
        nombreAdministrador={nombreAdministrador}
      />
    </>
  );
}

function SeccionEloy({
  nombre,
  dispositivo,
  esAdministrador,
  nombreAdministrador,
}: {
  nombre: string | undefined;
  dispositivo: Dispositivo | null;
  esAdministrador: boolean;
  nombreAdministrador: string;
}) {
  const router = useRouter();
  const cambiarVolumen = useCambiarVolumen(() =>
    Alert.alert('No se pudo cambiar el volumen', AVISO_SIN_INTERNET),
  );
  const restaurar = useRestaurarFabrica();

  const de = nombre ? `de ${nombre}` : 'de la persona';

  // Doble confirmación: primero se explica qué se borra, después se pide el sí definitivo.
  const confirmarRestaurar = () =>
    Alert.alert(
      '¿Restaurar a Eloy de fábrica?',
      `Se borra todo lo que Eloy sabe ${de}: las charlas, los recordatorios y la familia. No se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () =>
            Alert.alert('¿Seguro?', 'Es la última confirmación.', [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Restaurar',
                style: 'destructive',
                onPress: () =>
                  restaurar.mutate(undefined, {
                    onSuccess: () =>
                      Alert.alert('Listo', 'Eloy quedó como nuevo. Para volver a usarlo, vinculalo de nuevo.'),
                    onError: () => Alert.alert('No se pudo restaurar a Eloy', AVISO_SIN_INTERNET),
                  }),
              },
            ]),
        },
      ],
    );

  return (
    <View style={estilos.seccion}>
      <Texto variante="etiqueta" accessibilityRole="header">
        Eloy
      </Texto>

      {dispositivo ? (
        <>
          {/* El volumen solo lo cambia un administrador; los demás lo ven sin slider. */}
          <TarjetaEloy
            dispositivo={dispositivo}
            onCambiarVolumen={esAdministrador ? (volumen) => cambiarVolumen.mutate(volumen) : undefined}
          />
          {esAdministrador && (
            <View style={estilos.restaurar}>
              <Boton
                titulo="Restaurar de fábrica"
                variante="peligro"
                onPress={confirmarRestaurar}
                cargando={restaurar.isPending}
              />
              <Texto variante="secundario" centrado>
                Borra todo lo que Eloy sabe {de}. Pide confirmar dos veces.
              </Texto>
            </View>
          )}
        </>
      ) : (
        <>
          <Tarjeta>
            <Texto>Eloy todavía no está vinculado. Se hace escaneando el código que aparece en su pantalla.</Texto>
          </Tarjeta>
          {/* Para la persona actual: el backend solo se lo permite a un administrador. */}
          {esAdministrador ? (
            <Boton titulo="Vincular a Eloy" variante="contorno" onPress={() => router.push('/vincular')} />
          ) : (
            <Texto color="textoSecundario" centrado>
              Pedile a {nombreAdministrador} que vincule a Eloy.
            </Texto>
          )}
        </>
      )}
    </View>
  );
}

function CerrarSesion() {
  const { salir } = useSesion();
  const [saliendo, setSaliendo] = useState(false);

  // Al cerrar la sesión, la navegación vuelve sola al login.
  const cerrar = () => {
    setSaliendo(true);
    salir();
  };

  return <Boton titulo="Cerrar sesión" variante="contorno" onPress={cerrar} cargando={saliendo} />;
}

const estilos = StyleSheet.create({
  columna: { gap: espacio[6] },
  seccion: { gap: espacio[4] },
  restaurar: { gap: espacio[2] },
});
