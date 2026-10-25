import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { MessageSquare, Settings } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { consultas } from '@/api/consultas';
import type { EstadoPersona, Inicio as DatosInicio } from '@/api/tipos';
import { usePersonaActual } from '@/api/usePersonaActual';
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
  const persona = usePersonaActual();
  const inicio = useQuery(consultas.inicio(persona.id));
  const usuario = useQuery(consultas.usuario);

  return (
    <Pantalla>
      <View style={estilos.columna}>
        <View style={estilos.encabezado}>
          <Logo />
          <BotonIcono icono={Settings} etiqueta="Ajustes de la familia" onPress={() => router.navigate('/familia')} />
        </View>

        {inicio.isPending ? (
          <Cargando />
        ) : inicio.isError ? (
          <ErrorAlCargar onReintentar={() => inicio.refetch()} reintentando={inicio.isFetching} />
        ) : (
          <Resumen inicio={inicio.data} nombreUsuario={usuario.data?.nombre} />
        )}
      </View>
    </Pantalla>
  );
}

function Resumen({ inicio, nombreUsuario }: { inicio: DatosInicio; nombreUsuario: string | undefined }) {
  const router = useRouter();
  const nombre = inicio.persona.nombre;
  const cumplidos = inicio.recordatoriosCumplidos;
  const total = inicio.recordatoriosTotal;
  const alertaAbierta = inicio.idAlertaAbierta;
  const proximo = inicio.proximoRecordatorio;
  // Eloy escribe el resumen a las 21: durante el día viene el de ayer.
  const deAyer = inicio.resumen !== null && !inicio.resumen.esDeHoy;

  return (
    <>
      {alertaAbierta !== null && (
        <CartelAlerta
          titulo="Hay una alerta abierta"
          detalle="Tocá para ver qué pasó"
          onPress={() => router.push(`/alerta/${alertaAbierta}`)}
        />
      )}

      <View>
        <Texto color="textoSecundario">{nombreUsuario ? `Hola, ${nombreUsuario}` : 'Hola'}</Texto>
        <View style={estilos.estado}>
          <PuntoEstado estado={inicio.estado} />
          <Texto variante="titulo" accessibilityRole="header" style={estilos.flex}>
            {frasePorEstado[inicio.estado](nombre)}
          </Texto>
        </View>
        <Texto color="textoSecundario">
          {inicio.ultimaCharla
            ? `Última charla con Eloy: ${cuandoFue(inicio.ultimaCharla)}`
            : `${nombre} todavía no charló con Eloy`}
        </Texto>
      </View>

      <Tarjeta style={estilos.tarjetaResumen}>
        <Texto variante="etiqueta">{deAyer ? 'Resumen de ayer' : 'Resumen de hoy'}</Texto>
        {inicio.resumen ? (
          <Texto>{inicio.resumen.texto}</Texto>
        ) : (
          <Texto color="textoSecundario">Cuando {nombre} charle con Eloy, acá vas a ver un resumen del día.</Texto>
        )}
      </Tarjeta>

      <View style={estilos.datos}>
        <Dato valor={inicio.charlas} etiqueta={plural(inicio.charlas, 'charla', 'charlas')} />
        <Dato valor={inicio.minutos} etiqueta={plural(inicio.minutos, 'minuto', 'minutos')} />
        <Dato
          valor={`${cumplidos}/${total}`}
          etiqueta={plural(total, 'recordatorio', 'recordatorios')}
          accessibilityLabel={`${cumplidos} de ${total} ${plural(total, 'recordatorio cumplido', 'recordatorios cumplidos')}`}
        />
      </View>

      <Tarjeta>
        {proximo ? (
          <View style={estilos.proximo} accessible>
            <Texto variante="hora">{proximo.hora}</Texto>
            <View style={estilos.flex}>
              <Texto variante="secundario">Próximo recordatorio</Texto>
              <Texto variante="cuerpoFuerte">{proximo.titulo}</Texto>
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
