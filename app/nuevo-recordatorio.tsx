import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import type { DiaSemana, Recordatorio, RecordatorioNuevo } from '@/api/tipos';
import { useCrearRecordatorio } from '@/api/useCrearRecordatorio';
import {
  Boton,
  BotonVolver,
  CampoTexto,
  OpcionUnica,
  Pantalla,
  SelectorDias,
  SelectorFechaHora,
  Tarjeta,
  Texto,
} from '@/componentes';
import { aFechaTexto, aHoraTexto } from '@/fechas';
import { espacio } from '@/tema';

type Repeticion = Recordatorio['repeticion'];

const OPCIONES: { valor: Repeticion; etiqueta: string }[] = [
  { valor: 'diaria', etiqueta: 'Todos los días' },
  { valor: 'semanal', etiqueta: 'Algunos días' },
  { valor: 'una_vez', etiqueta: 'Una sola vez' },
];

function inicioDeHoy(): Date {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy;
}

function nueveDeLaManana(): Date {
  const hora = new Date();
  hora.setHours(9, 0, 0, 0);
  return hora;
}

export default function NuevoRecordatorio() {
  const router = useRouter();
  const crear = useCrearRecordatorio();

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [hora, setHora] = useState(nueveDeLaManana);
  const [repeticion, setRepeticion] = useState<Repeticion>('diaria');
  const [dias, setDias] = useState<DiaSemana[]>([]);
  const [fecha, setFecha] = useState(inicioDeHoy);

  const ahora = new Date();
  const faltanDias = repeticion === 'semanal' && dias.length === 0;
  const yaPaso =
    repeticion === 'una_vez' && aFechaTexto(fecha) === aFechaTexto(ahora) && aHoraTexto(hora) <= aHoraTexto(ahora);
  const completo = titulo.trim().length > 0 && !faltanDias && !yaPaso;

  // Con los 7 días marcados se guarda como diario: así un mismo recordatorio no queda guardado de dos formas.
  const armarDatos = (): RecordatorioNuevo => {
    const todaLaSemana = repeticion === 'semanal' && dias.length === 7;
    const tipo: Repeticion = todaLaSemana ? 'diaria' : repeticion;
    return {
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      hora: aHoraTexto(hora),
      repeticion: tipo,
      diasSemana: tipo === 'semanal' ? dias : null,
      fechaUnica: tipo === 'una_vez' ? aFechaTexto(fecha) : null,
    };
  };

  const guardar = () => {
    crear.mutate(armarDatos(), {
      onSuccess: () => router.back(),
      onError: () =>
        Alert.alert('No se pudo guardar el recordatorio', 'Revisá que el teléfono tenga internet y probá de nuevo.'),
    });
  };

  return (
    // Con el borde de arriba: en la hoja del modal vale 0, pero si se abre como pantalla completa no queda bajo el reloj.
    <Pantalla bordes={['top', 'bottom', 'left', 'right']}>
      <View style={estilos.columna}>
        <View style={estilos.encabezado}>
          <Texto variante="titulo" accessibilityRole="header" style={estilos.flex}>
            Nuevo recordatorio
          </Texto>
          <BotonVolver cerrar />
        </View>

        <CampoTexto
          etiqueta="Qué le recordamos"
          value={titulo}
          onChangeText={setTitulo}
          placeholder="Por ejemplo: Pastilla de la presión"
          maxLength={80}
          returnKeyType="next"
        />
        <CampoTexto
          etiqueta="Detalle (opcional)"
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="Por ejemplo: la blanca, con agua"
          maxLength={200}
          multiline
        />

        <Tarjeta style={estilos.tarjetaFila}>
          <SelectorFechaHora etiqueta="Hora" modo="time" valor={hora} onCambiar={setHora} />
        </Tarjeta>

        <View style={estilos.seccion}>
          <Texto variante="cuerpoFuerte">Cuándo</Texto>
          <OpcionUnica etiqueta="Cuándo" opciones={OPCIONES} valor={repeticion} onCambiar={setRepeticion} />
        </View>

        {repeticion === 'semanal' && (
          <View style={estilos.seccion}>
            <SelectorDias seleccionados={dias} onCambiar={setDias} />
            {faltanDias && <Texto color="textoSecundario">Elegí al menos un día.</Texto>}
          </View>
        )}

        {repeticion === 'una_vez' && (
          <View style={estilos.seccion}>
            <Tarjeta style={estilos.tarjetaFila}>
              <SelectorFechaHora etiqueta="Fecha" modo="date" valor={fecha} onCambiar={setFecha} minimo={inicioDeHoy()} />
            </Tarjeta>
            {yaPaso && <Texto color="textoSecundario">Esa hora ya pasó. Elegí otra hora u otro día.</Texto>}
          </View>
        )}

        <Boton titulo="Guardar" onPress={guardar} deshabilitado={!completo} cargando={crear.isPending} />
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: espacio[5] },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
    paddingTop: espacio[2],
  },
  flex: { flex: 1 },
  seccion: { gap: espacio[3] },
  tarjetaFila: { paddingVertical: espacio[2] },
});
