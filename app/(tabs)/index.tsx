import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { MessageSquare, Settings } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { consultas } from '@/api/consultas';
import type { EstadoPersona, Hoy } from '@/api/tipos';
import {
  Boton,
  BotonIcono,
  Cargando,
  CartelAlerta,
  Dato,
  ErrorAlCargar,
  Logo,
  Pantalla,
  PuntoEstado,
  Tarjeta,
  Texto,
} from '@/componentes';
import { cuandoFue } from '@/fechas';
import { espacio } from '@/tema';

const frasePorEstado: Record<EstadoPersona, (nombre: string) => string> = {
  bien: (nombre) => `${nombre} está bien`,
  atencion: (nombre) => `Fijate cómo está ${nombre}`,
  sin_conexion: () => 'Eloy está sin conexión',
  alerta: (nombre) => `${nombre} pidió ayuda`,
};

function plural(cantidad: number, singular: string, plural: string) {
  return cantidad === 1 ? singular : plural;
}

export default function Inicio() {
  const router = useRouter();
  const hoy = useQuery(consultas.hoy);
  const yo = useQuery(consultas.yo);

  return (
    <Pantalla>
      <View style={estilos.columna}>
        <View style={estilos.encabezado}>
          <Logo />
          <BotonIcono icono={Settings} etiqueta="Ajustes de la familia" onPress={() => router.navigate('/familia')} />
        </View>

        {hoy.isPending ? (
          <Cargando />
        ) : hoy.isError ? (
          <ErrorAlCargar onReintentar={() => hoy.refetch()} reintentando={hoy.isFetching} />
        ) : (
          <Resumen hoy={hoy.data} nombreUsuario={yo.data?.nombre} />
        )}
      </View>
    </Pantalla>
  );
}

function Resumen({ hoy, nombreUsuario }: { hoy: Hoy; nombreUsuario: string | undefined }) {
  const router = useRouter();
  const nombre = hoy.persona.nombre;
  const { cumplidos, total } = hoy.recordatorios;

  return (
    <>
      {hoy.alertaAbiertaId !== null && (
        <CartelAlerta
          titulo="Hay una alerta abierta"
          detalle="Tocá para ver qué pasó"
          onPress={() => router.push(`/alerta/${hoy.alertaAbiertaId}`)}
        />
      )}

      <View>
        <Texto color="textoSecundario">{nombreUsuario ? `Hola, ${nombreUsuario}` : 'Hola'}</Texto>
        <View style={estilos.estado}>
          <PuntoEstado estado={hoy.estado} />
          <Texto variante="titulo" accessibilityRole="header" style={estilos.flex}>
            {frasePorEstado[hoy.estado](nombre)}
          </Texto>
        </View>
        <Texto color="textoSecundario">
          {hoy.ultimaCharla
            ? `Última charla con Eloy: ${cuandoFue(hoy.ultimaCharla)}`
            : `${nombre} todavía no charló con Eloy`}
        </Texto>
      </View>

      <Tarjeta style={estilos.tarjetaResumen}>
        <Texto variante="etiqueta">Resumen de hoy</Texto>
        {hoy.resumen ? (
          <Texto>{hoy.resumen}</Texto>
        ) : (
          <Texto color="textoSecundario">Cuando {nombre} charle con Eloy, acá vas a ver un resumen del día.</Texto>
        )}
      </Tarjeta>

      <View style={estilos.datos}>
        <Dato valor={hoy.charlas} etiqueta={plural(hoy.charlas, 'charla', 'charlas')} />
        <Dato valor={hoy.minutos} etiqueta={plural(hoy.minutos, 'minuto', 'minutos')} />
        <Dato
          valor={`${cumplidos}/${total}`}
          etiqueta={plural(total, 'recordatorio', 'recordatorios')}
          accessibilityLabel={`${cumplidos} de ${total} ${plural(total, 'recordatorio cumplido', 'recordatorios cumplidos')}`}
        />
      </View>

      <Tarjeta>
        {hoy.proximo ? (
          <View style={estilos.proximo} accessible>
            <Texto variante="hora">{hoy.proximo.hora}</Texto>
            <View style={estilos.flex}>
              <Texto variante="secundario">Próximo recordatorio</Texto>
              <Texto variante="cuerpoFuerte">{hoy.proximo.titulo}</Texto>
            </View>
          </View>
        ) : (
          <Texto color="textoSecundario">No quedan recordatorios por hoy.</Texto>
        )}
      </Tarjeta>

      <Boton titulo="Mandarle un mensaje" icono={MessageSquare} onPress={() => router.navigate('/mensajes')} />
    </>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: espacio[5] },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  estado: { flexDirection: 'row', alignItems: 'center', gap: espacio[3], marginVertical: espacio[1] },
  flex: { flex: 1 },
  tarjetaResumen: { gap: espacio[2] },
  datos: { flexDirection: 'row', gap: espacio[3] },
  proximo: { flexDirection: 'row', alignItems: 'center', gap: espacio[5] },
});
