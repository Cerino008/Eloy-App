// TEMPORAL: muestrario de componentes para revisarlos en el iPhone.
// Se borra cuando armemos las pestañas.
import { MessageSquare, Mic, Phone, Plus, Send, Settings } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  Boton,
  BotonIcono,
  Chip,
  Dato,
  Pantalla,
  PuntoEstado,
  Separador,
  Tarjeta,
  Texto,
} from '@/componentes';
import { espacio } from '@/tema';

const nada = () => {};

export default function Muestrario() {
  return (
    <Pantalla>
      <View style={estilos.columna}>
        <View style={estilos.fila}>
          <Texto variante="etiqueta">Muestrario</Texto>
          <BotonIcono icono={Settings} etiqueta="Ajustes" onPress={nada} />
        </View>

        <View>
          <Texto variante="secundario">Hola, Bautista</Texto>
          <View style={estilos.filaIzq}>
            <PuntoEstado estado="bien" />
            <Texto variante="titulo">Marta está bien</Texto>
          </View>
          <Texto variante="secundario">Última charla con Eloy: hoy a las 10:42</Texto>
        </View>

        <View style={estilos.filaIzq}>
          <PuntoEstado estado="atencion" />
          <PuntoEstado estado="sin_conexion" />
          <PuntoEstado estado="alerta" />
        </View>

        <Tarjeta>
          <Texto variante="etiqueta">Resumen de hoy</Texto>
          <Texto>Charló un rato a la mañana y contó que está tejiendo una bufanda para su nieta.</Texto>
        </Tarjeta>

        <View style={estilos.filaIzq}>
          <Dato valor={3} etiqueta="charlas" />
          <Dato valor={18} etiqueta="minutos" />
          <Dato valor="2/3" etiqueta="recordatorios" accessibilityLabel="2 de 3 recordatorios" />
        </View>

        <Tarjeta lista>
          <View style={estilos.filaLista}>
            <Texto variante="hora">09:00</Texto>
            <View style={estilos.flex}>
              <Texto variante="cuerpoFuerte">Pastilla de la presión</Texto>
              <Texto variante="secundario">Todos los días</Texto>
            </View>
            <Chip texto="Sonó" variante="exito" />
          </View>
          <Separador />
          <View style={estilos.filaLista}>
            <Texto variante="hora">18:00</Texto>
            <View style={estilos.flex}>
              <Texto variante="cuerpoFuerte">Pastilla de la tarde</Texto>
              <Texto variante="secundario">Todos los días</Texto>
            </View>
            <Chip texto="Pendiente" />
          </View>
        </Tarjeta>

        <Tarjeta lista>
          <View style={estilos.filaLista}>
            <Avatar nombre="Bautista" variante="yo" />
            <Texto variante="cuerpoFuerte">Bautista (vos)</Texto>
          </View>
          <Separador />
          <View style={estilos.filaLista}>
            <Avatar nombre="Vero" />
            <Texto variante="cuerpoFuerte">Vero</Texto>
          </View>
          <Separador />
          <View style={estilos.filaLista}>
            <Avatar nombre="Marta" variante="persona" tamano={44} />
            <Texto variante="subtitulo">Marta</Texto>
          </View>
        </Tarjeta>

        <View style={estilos.filaIzq}>
          <BotonIcono icono={Mic} etiqueta="Grabar un audio" variante="suave" onPress={nada} />
          <BotonIcono icono={Send} etiqueta="Enviar" variante="principal" onPress={nada} />
        </View>

        <Boton titulo="Mandarle un mensaje" icono={MessageSquare} onPress={nada} />
        <Boton titulo="Escribir el código a mano" variante="contorno" onPress={nada} />
        <Boton titulo="Restaurar de fábrica" variante="peligro" onPress={nada} />
        <Boton titulo="Guardando" variante="contorno" cargando onPress={nada} />
        <Boton titulo="Agregar recordatorio" icono={Plus} variante="contorno" deshabilitado onPress={nada} />

        <Tarjeta fondo="alerta">
          <View style={estilos.columna}>
            <Texto variante="tituloGrande" color="textoSobreOscuro">
              Marta pidió ayuda
            </Texto>
            <Tarjeta fondo="alertaOscuro">
              <Texto variante="cuerpoFuerte" color="textoSobreOscuro">
                También avisamos a
              </Texto>
              <Texto color="textoSobreOscuro">Vero (hija) y Juan (nieto)</Texto>
            </Tarjeta>
            <Boton titulo="Llamar a Marta" icono={Phone} variante="alertaClaro" onPress={nada} />
            <Boton titulo="Ya me ocupo yo" variante="alertaContorno" onPress={nada} />
            <Texto variante="chica" color="textoSobreOscuro" centrado>
              Al tocar “Ya me ocupo yo”, el resto de la familia lo ve
            </Texto>
          </View>
        </Tarjeta>
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: espacio[4] },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filaIzq: { flexDirection: 'row', alignItems: 'center', gap: espacio[3] },
  filaLista: { flexDirection: 'row', alignItems: 'center', gap: espacio[4], paddingVertical: espacio[4] },
  flex: { flex: 1 },
});
