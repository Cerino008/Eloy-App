import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { consultas } from '@/api/consultas';
import type { Recordatorio, Recordatorios as Lista } from '@/api/tipos';
import { usePersonaActual } from '@/api/usePersonaActual';
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
import { espacio } from '@/tema';

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
  const persona = usePersonaActual();
  const recordatorios = useQuery(consultas.recordatorios(persona.id));

  return (
    <Pantalla>
      <View style={estilos.columna}>
        <View>
          <Texto variante="titulo" accessibilityRole="header">
            Recordatorios
          </Texto>
          <Texto color="textoSecundario">Eloy se los dice a {persona.nombre} en voz alta</Texto>
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
            <Contenido lista={recordatorios.data} />
            <Boton titulo="Agregar recordatorio" icono={Plus} onPress={() => router.push('/nuevo-recordatorio')} />
          </>
        )}
      </View>
    </Pantalla>
  );
}

// El servidor ya los separa en "Hoy" (con sonó / pendiente) y "Próximos días", y los ordena.
function Contenido({ lista }: { lista: Lista }) {
  return (
    <>
      <Seccion titulo="Hoy" recordatorios={lista.hoy} vacio="Hoy no hay recordatorios." />
      <Seccion titulo="Próximos días" recordatorios={lista.proximos} vacio="No hay otros recordatorios cargados." />
    </>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: espacio[6] },
  seccion: { gap: espacio[3] },
  vacio: { paddingVertical: espacio[4] },
});
