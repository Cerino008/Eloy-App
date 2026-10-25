import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { api } from '@/api/cliente';
import { consultas } from '@/api/consultas';
import type { Dispositivo, Familia as DatosFamilia, Familiar } from '@/api/tipos';
import { useCambiarVolumen } from '@/api/useCambiarVolumen';
import { usePersonaActual } from '@/api/usePersonaActual';
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
import { useRecargarMientras } from '@/useRecargarMientras';

const AVISO_SIN_INTERNET = 'Revisá que el teléfono tenga internet y probá de nuevo.';

// Los que no reciben alertas van al final, aunque tengan un número.
function ordenDeAviso(familiar: Familiar): number {
  return familiar.recibeAlertas ? (familiar.prioridadAlerta ?? Infinity) : Infinity;
}

// Primero vos; después por orden de aviso; a igual orden, por nombre.
function ordenar(familiares: Familiar[]): Familiar[] {
  return [...familiares].sort((a, b) => {
    if (a.soyYo) return -1;
    if (b.soyYo) return 1;
    const orden = ordenDeAviso(a) - ordenDeAviso(b);
    return orden !== 0 ? orden : a.nombre.localeCompare(b.nombre);
  });
}

export default function Familia() {
  const persona = usePersonaActual();
  const familia = useQuery(consultas.familia(persona.id));

  return (
    <Pantalla>
      <View style={estilos.columna}>
        <Texto variante="titulo" accessibilityRole="header">
          Familia
        </Texto>

        {familia.isPending ? (
          <Cargando />
        ) : familia.isError ? (
          <ErrorAlCargar onReintentar={() => familia.refetch()} reintentando={familia.isFetching} />
        ) : (
          <Contenido familia={familia.data} />
        )}

        <CerrarSesion />
      </View>
    </Pantalla>
  );
}

function Contenido({ familia }: { familia: DatosFamilia }) {
  const persona = usePersonaActual();
  const esAdministrador = familia.miRol === 'administrador';
  const administrador = familia.familiares.find((familiar) => familiar.rol === 'administrador');
  const nombreAdministrador = administrador?.nombre ?? 'quien administra la familia';
  // Por ahora, un Eloy por persona.
  const dispositivo = familia.dispositivos[0] ?? null;

  const invitar = useMutation({
    mutationFn: () => api.invitarFamiliar(persona.id),
    // El código ya viaja en el link; va también aparte por si la app se lo pide.
    onSuccess: ({ link, codigo }) =>
      Share.share({
        message:
          `Te invito a la app de Eloy para estar cerca de ${persona.nombre}. ` +
          `Entrá desde este link: ${link}\n\nSi te pide un código: ${codigo}`,
      }),
    onError: () => Alert.alert('No pudimos crear la invitación', AVISO_SIN_INTERNET),
  });

  return (
    <>
      <View style={estilos.seccion}>
        <Tarjeta lista>
          {ordenar(familia.familiares).map((familiar, i) => (
            <Fragment key={familiar.id}>
              {i > 0 && <Separador />}
              <FilaFamiliar familiar={familiar} />
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

      <View style={estilos.seccion}>
        <Texto variante="etiqueta" accessibilityRole="header">
          Eloy
        </Texto>
        {dispositivo ? (
          <EloyVinculado dispositivo={dispositivo} esAdministrador={esAdministrador} />
        ) : (
          <SinEloy esAdministrador={esAdministrador} nombreAdministrador={nombreAdministrador} />
        )}
      </View>
    </>
  );
}

function EloyVinculado({ dispositivo, esAdministrador }: { dispositivo: Dispositivo; esAdministrador: boolean }) {
  const persona = usePersonaActual();
  const queryClient = useQueryClient();
  const volumen = useCambiarVolumen(dispositivo.id, dispositivo.volumen, () =>
    Alert.alert('No se pudo cambiar el volumen', AVISO_SIN_INTERNET),
  );
  const restaurar = useRestaurarFabrica(persona.id, dispositivo.id);

  // Mientras Eloy no aplica el volumen o la restauración, se recarga para ver cuándo lo hace.
  const recargar = useCallback(
    () => queryClient.invalidateQueries({ queryKey: consultas.familia(persona.id).queryKey }),
    [queryClient, persona.id],
  );
  useRecargarMientras(volumen.esperando || dispositivo.restaurando, recargar);

  const de = `de ${persona.nombre}`;
  const avisoVolumen = volumen.esperando
    ? 'Eloy lo cambia en la próxima sincronización.'
    : volumen.demorado
      ? 'Eloy todavía no lo aplicó. Puede estar sin conexión.'
      : null;

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
                    // El backend responde 202: lo hace Eloy cuando sincroniza.
                    onSuccess: () =>
                      Alert.alert(
                        'Listo',
                        'Eloy se restaura en la próxima sincronización. Para volver a usarlo, vas a tener que vincularlo de nuevo.',
                      ),
                    onError: () => Alert.alert('No se pudo restaurar a Eloy', AVISO_SIN_INTERNET),
                  }),
              },
            ]),
        },
      ],
    );

  return (
    <>
      {/* El volumen solo lo cambia un administrador; los demás lo ven sin slider. */}
      <TarjetaEloy
        dispositivo={dispositivo}
        onCambiarVolumen={esAdministrador ? volumen.cambiar : undefined}
        volumenPedido={volumen.volumenPedido}
        avisoVolumen={avisoVolumen}
      />
      {dispositivo.restaurando ? (
        <Texto variante="secundario" centrado>
          Eloy se está restaurando. Cuando termine, para volver a usarlo vas a tener que vincularlo de nuevo.
        </Texto>
      ) : (
        esAdministrador && (
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
        )
      )}
    </>
  );
}

function SinEloy({ esAdministrador, nombreAdministrador }: { esAdministrador: boolean; nombreAdministrador: string }) {
  const router = useRouter();

  return (
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
