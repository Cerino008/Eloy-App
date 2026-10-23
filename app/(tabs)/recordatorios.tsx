import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { consultas } from '@/api/consultas';
import type { Recordatorio } from '@/api/tipos';
import {
  Boton,
  Cargando,
  ErrorAlCargar,
  FilaRecordatorio,
  Pantalla,
  Separador,
  Tarjeta,
  Texto,
} from '@/componentes';
import { proximaVez } from '@/recordatorios';
import { espacio } from '@/tema';

// "Hoy": los que suenan hoy (traen estadoHoy), por hora.
// "Próximos días": el resto, por cuál suena primero; los que ya no van a sonar, al final.
function separar(recordatorios: Recordatorio[]) {
  const ahora = new Date();
  const hoy = recordatorios
    .filter((recordatorio) => recordatorio.estadoHoy !== undefined)
    .sort((a, b) => a.hora.localeCompare(b.hora));
  const proximos = recordatorios
    .filter((recordatorio) => recordatorio.estadoHoy === undefined)
    .map((recordatorio) => ({ recordatorio, cuando: proximaVez(recordatorio, ahora)?.getTime() ?? Infinity }))
    .sort((a, b) => a.cuando - b.cuando)
    .map(({ recordatorio }) => recordatorio);
  return { hoy, proximos };
}

function Seccion({ titulo, recordatorios, vacio }: { titulo: string; recordatorios: Recordatorio[]; vacio: string }) {
  return (
    <View style={estilos.seccion}>
      <Texto variante="etiqueta" accessibilityRole="header">
        {titulo}
      </Texto>
      <Tarjeta lista>
        {recordatorios.length === 0 ? (
          <Texto color="textoSecundario" style={estilos.vacio}>
            {vacio}
          </Texto>
        ) : (
          recordatorios.map((recordatorio, i) => (
            <Fragment key={recordatorio.id}>
              {i > 0 && <Separador />}
              <FilaRecordatorio recordatorio={recordatorio} />
            </Fragment>
          ))
        )}
      </Tarjeta>
    </View>
  );
}

export default function Recordatorios() {
  const router = useRouter();
  const recordatorios = useQuery(consultas.recordatorios);
  const nombre = useQuery(consultas.hoy).data?.persona.nombre;

  return (
    <Pantalla>
      <View style={estilos.columna}>
        <View>
          <Texto variante="titulo" accessibilityRole="header">
            Recordatorios
          </Texto>
          <Texto color="textoSecundario">Eloy se los dice{nombre ? ` a ${nombre}` : ''} en voz alta</Texto>
        </View>

        {recordatorios.isPending ? (
          <Cargando />
        ) : recordatorios.isError ? (
          <ErrorAlCargar
            titulo="No pudimos traer los recordatorios"
            onReintentar={() => recordatorios.refetch()}
            reintentando={recordatorios.isFetching}
          />
        ) : (
          <>
            <Contenido recordatorios={recordatorios.data} />
            <Boton titulo="Agregar recordatorio" icono={Plus} onPress={() => router.push('/nuevo-recordatorio')} />
          </>
        )}
      </View>
    </Pantalla>
  );
}

function Contenido({ recordatorios }: { recordatorios: Recordatorio[] }) {
  const { hoy, proximos } = separar(recordatorios);

  return (
    <>
      <Seccion titulo="Hoy" recordatorios={hoy} vacio="Hoy no hay recordatorios." />
      <Seccion titulo="Próximos días" recordatorios={proximos} vacio="No hay otros recordatorios cargados." />
    </>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: espacio[6] },
  seccion: { gap: espacio[3] },
  vacio: { paddingVertical: espacio[4] },
});
