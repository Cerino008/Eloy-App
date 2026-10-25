// Datos de ejemplo mientras no hay backend. Solo los lee cliente.ts, nunca las pantallas.
// Están como los guarda la base: lo que depende de quién pregunta o de la hora (esMio, soyYo, el estado
// de los recordatorios de hoy...) lo calcula cliente.ts al responder, como el servidor.
import { aFechaTexto } from '@/fechas';

import type {
  Alerta,
  Dispositivo,
  EstadoPersona,
  Familiar,
  Inicio,
  Mensaje,
  PersonaResumen,
  Recordatorio,
  Usuario,
} from './tipos';

export type MensajeGuardado = Omit<Mensaje, 'esMio'> & {
  idFamiliarEmisor: number | null; // null = lo mandó la persona
};
export type RecordatorioGuardado = Omit<Recordatorio, 'estado' | 'proximaFecha'>;
export type FamiliarGuardado = Omit<Familiar, 'soyYo'>;

// Para probar otros casos en el teléfono: cambiá estos valores y guardá.
export const escenario = {
  estado: 'bien' as EstadoPersona, // el que calcularía el servidor si no hay alerta ni falta conexión
  alertaAbierta: false,
  fallar: false, // las llamadas a la API fallan, para ver el estado de error
  sinDispositivo: false, // todavía no hay un Eloy vinculado
  atendidaPorOtro: false, // "Ya me ocupo yo" falla como el 409 del backend: Vero ya la tomó
  sinPersonas: false, // la cuenta todavía no sigue a nadie: después de entrar se ve la bienvenida
  eloyNoSincroniza: false, // el volumen y restaurar quedan pendientes para siempre (Eloy sin conexión)
};

// Emails que fallan a propósito, para ver los errores del login y del registro.
export const emailsDePrueba = {
  incorrecto: 'incorrecto@ejemplo.com', // el login responde 401
  registrado: 'registrado@ejemplo.com', // el registro responde 409: ya hay una cuenta
};

// Hace tantos días, a esa hora del teléfono, en UTC como lo manda la API.
function haceDias(dias: number, horas: number, minutos: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  fecha.setHours(horas, minutos, 0, 0);
  return fecha.toISOString();
}

// Para probar Vincular y Aceptar invitación. El vencido da el mismo 404 que uno mal escrito, como el backend.
export const codigosDePrueba = {
  vinculacion: 'K7M4PX',
  vinculacionVencido: 'H3Q9WZ',
  invitacion: 'Xk3vP9qL2mN8rT5wY7zA4bC6dE2fGhJu',
  invitacionVencida: 'Vn8cQ7mP2xK9rT4wY6zA3bC5dE2fGhJu',
};

// La cuenta con la que se entra (GET /auth/yo).
export const usuario: Usuario = {
  id: 1,
  nombre: 'Bautista',
  apellido: null,
  email: 'bautista@ejemplo.com',
  telefono: null,
};

// Bautista en la familia de Marta.
export const miFamiliar: FamiliarGuardado = {
  id: 1,
  nombre: 'Bautista',
  parentesco: 'Hijo',
  rol: 'administrador',
  recibeAlertas: true,
  prioridadAlerta: 2,
  telefono: null,
  tieneCuenta: true,
};

const VERO_ID = 2;
const JUAN_ID = 3;

export const familiares: FamiliarGuardado[] = [
  miFamiliar,
  {
    id: VERO_ID,
    nombre: 'Vero',
    parentesco: 'Hija',
    rol: 'familiar',
    recibeAlertas: true,
    prioridadAlerta: 1,
    telefono: '+5491100000001',
    tieneCuenta: true,
  },
  {
    id: JUAN_ID,
    nombre: 'Juan',
    parentesco: 'Nieto',
    rol: 'familiar',
    recibeAlertas: true,
    prioridadAlerta: 3,
    telefono: null,
    tieneCuenta: true,
  },
];

export const dispositivo: Dispositivo = {
  id: 1,
  conectado: true,
  ultimaConexion: new Date(Date.now() - 60 * 1000).toISOString(),
  wifiSsid: 'Casa de Marta',
  volumen: 70,
  versionSoftware: '1.2.0',
  restaurando: false,
};

// A quién sigue la cuenta (GET /personas). La app usa la primera.
export const personas: PersonaResumen[] = [
  { id: 1, nombre: 'Marta', miRol: miFamiliar.rol, idMiFamiliar: miFamiliar.id },
];

// El estado, los recordatorios de hoy, el próximo y la alerta abierta los calcula cliente.ts.
export const inicio: Pick<Inicio, 'persona' | 'ultimaCharla' | 'resumen' | 'charlas' | 'minutos'> = {
  persona: { id: 1, nombre: 'Marta' },
  ultimaCharla: haceDias(0, 10, 42),
  resumen: {
    fecha: aFechaTexto(new Date()),
    texto:
      'Charló un rato a la mañana y contó que está tejiendo una bufanda para su nieta. ' +
      'Tomó la pastilla de las 9 cuando Eloy se la recordó.',
    esDeHoy: true,
  },
  charlas: 3,
  minutos: 18,
};

// La de escenario.alertaAbierta: Marta pidió ayuda hace 5 minutos.
export const alerta: Alerta = {
  id: 1,
  idPersona: 1,
  persona: 'Marta',
  telefonoPersona: '+5491100000000',
  estado: 'abierta',
  origen: 'voz',
  motivo: 'Me caí en la cocina y no me puedo levantar',
  // Todavía no hay audios reales: el reproductor se muestra pero no suena.
  audioUrl: 'ejemplo://audio/alerta-1',
  audioDuracionSeg: 5,
  ocurridaEn: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  atendidaPor: null,
  atendidaPorMi: false,
  atendidaEn: null,
  cerradaEn: null,
  notaCierre: null,
  tambienAvisamosA: [
    { nombre: 'Vero', parentesco: 'hija' },
    { nombre: 'Juan', parentesco: 'nieto' },
  ],
};

function diaSiguiente(): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 1);
  return aFechaTexto(fecha);
}

// Sin estado ni próxima fecha: los calcula el servidor (acá, cliente.ts) según el día y la hora.
export const recordatorios: RecordatorioGuardado[] = [
  {
    id: 1,
    titulo: 'Pastilla de la presión',
    descripcion: 'la blanca, con agua',
    hora: '09:00',
    repeticion: 'diaria',
    diasSemana: [],
    fechaUnica: null,
    creadoDesde: 'app',
    sincronizado: true,
  },
  {
    id: 2,
    titulo: 'Almorzar',
    descripcion: null,
    hora: '13:00',
    repeticion: 'diaria',
    diasSemana: [],
    fechaUnica: null,
    creadoDesde: 'app',
    sincronizado: true,
  },
  {
    id: 3,
    titulo: 'Pastilla de la tarde',
    descripcion: null,
    hora: '18:00',
    repeticion: 'diaria',
    diasSemana: [],
    fechaUnica: null,
    creadoDesde: 'app',
    sincronizado: true,
  },
  {
    id: 4,
    titulo: 'Turno con la doctora',
    descripcion: null,
    hora: '10:00',
    repeticion: 'una_vez',
    diasSemana: [],
    fechaUnica: diaSiguiente(),
    creadoDesde: 'app',
    sincronizado: true,
  },
  {
    id: 5,
    titulo: 'Gimnasia',
    descripcion: null,
    hora: '17:00',
    repeticion: 'semanal',
    diasSemana: ['lunes', 'jueves'],
    fechaUnica: null,
    creadoDesde: 'eloy',
    sincronizado: true,
  },
];

// Ordenados del más viejo al más nuevo.
export const mensajes: MensajeGuardado[] = [
  {
    id: 1,
    direccion: 'de_familia',
    de: 'Juan',
    idFamiliarEmisor: JUAN_ID,
    para: null,
    texto: 'Abuela, el sábado paso a verte con Sofi.',
    audioUrl: null,
    audioDuracionSeg: null,
    estado: 'leido',
    entregadoEn: haceDias(5, 18, 33),
    leidoEn: haceDias(5, 18, 40),
    creadoEn: haceDias(5, 18, 32),
  },
  {
    id: 2,
    direccion: 'a_familia',
    de: 'Marta',
    idFamiliarEmisor: null,
    para: null,
    texto: 'Hoy fui a la plaza con Rosa y tomamos un café.',
    audioUrl: null,
    audioDuracionSeg: null,
    estado: 'entregado',
    entregadoEn: haceDias(1, 17, 15),
    leidoEn: null,
    creadoEn: haceDias(1, 17, 15),
  },
  {
    id: 3,
    direccion: 'de_familia',
    de: 'Vero',
    idFamiliarEmisor: VERO_ID,
    para: null,
    texto: '¡Qué lindo, ma! Mandale saludos a Rosa.',
    audioUrl: null,
    audioDuracionSeg: null,
    estado: 'leido',
    entregadoEn: haceDias(1, 17, 31),
    leidoEn: haceDias(1, 17, 52),
    creadoEn: haceDias(1, 17, 30),
  },
  {
    id: 4,
    direccion: 'a_familia',
    de: 'Marta',
    idFamiliarEmisor: null,
    para: null,
    texto: 'Decile a Vero que el domingo la espero a comer',
    // Todavía no hay audios reales: la burbuja se muestra pero no reproduce.
    audioUrl: 'ejemplo://audio/4',
    audioDuracionSeg: 4,
    estado: 'entregado',
    entregadoEn: haceDias(0, 10, 45),
    leidoEn: null,
    creadoEn: haceDias(0, 10, 45),
  },
  {
    id: 5,
    direccion: 'de_familia',
    de: 'Bautista',
    idFamiliarEmisor: miFamiliar.id,
    para: null,
    texto: '¡Dale, mamá! Le aviso. Yo llevo las empanadas.',
    audioUrl: null,
    audioDuracionSeg: null,
    estado: 'leido',
    entregadoEn: haceDias(0, 11, 6),
    leidoEn: haceDias(0, 11, 20),
    creadoEn: haceDias(0, 11, 5),
  },
  {
    id: 6,
    direccion: 'de_familia',
    de: 'Bautista',
    idFamiliarEmisor: miFamiliar.id,
    para: null,
    texto: '¿Te acordaste de la pastilla del mediodía?',
    audioUrl: null,
    audioDuracionSeg: null,
    estado: 'pendiente',
    entregadoEn: null,
    leidoEn: null,
    creadoEn: haceDias(0, 12, 10),
  },
];
