// Datos de ejemplo mientras no hay backend. Solo los lee cliente.ts, nunca las pantallas.
import { aFechaTexto } from '@/fechas';

import type {
  Alerta,
  Dispositivo,
  EstadoPersona,
  Familiar,
  Hoy,
  Mensaje,
  PersonaResumen,
  Recordatorio,
  Usuario,
} from './tipos';

// Para probar otros casos en el teléfono: cambiá estos valores y guardá.
export const escenario = {
  estado: 'bien' as EstadoPersona,
  alertaAbierta: false,
  fallar: false, // las llamadas a la API fallan, para ver el estado de error
  sinDispositivo: false, // todavía no hay un Eloy vinculado
  atendidaPorOtro: false, // "Ya me ocupo yo" falla como el 409 del backend: Vero ya la tomó
  sinPersonas: false, // la cuenta todavía no sigue a nadie: después de entrar se ve la bienvenida
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

// La cuenta con la que se entra (GET /auth/yo).
export const usuario: Usuario = {
  id: 1,
  nombre: 'Bautista',
  apellido: null,
  email: 'bautista@ejemplo.com',
  telefono: null,
};

// Bautista en la familia de Marta.
export const miFamiliar: Familiar = {
  id: 1,
  nombre: 'Bautista',
  parentesco: 'Hijo',
  rol: 'administrador',
  prioridadAlerta: 2,
  tieneCuenta: true,
};

const VERO_ID = 2;
const JUAN_ID = 3;

export const familiares: Familiar[] = [
  miFamiliar,
  {
    id: VERO_ID,
    nombre: 'Vero',
    parentesco: 'Hija',
    rol: 'familiar',
    prioridadAlerta: 1,
    tieneCuenta: true,
  },
  {
    id: JUAN_ID,
    nombre: 'Juan',
    parentesco: 'Nieto',
    rol: 'familiar',
    prioridadAlerta: 3,
    tieneCuenta: true,
  },
];

export const dispositivo: Dispositivo = {
  conectado: true,
  ultimaConexion: new Date(Date.now() - 60 * 1000).toISOString(),
  wifiSsid: 'Casa de Marta',
  volumen: 70,
  versionSoftware: '1.2.0',
};

// A quién sigue la cuenta (GET /personas). La app usa la primera.
export const personas: PersonaResumen[] = [
  { id: 1, nombre: 'Marta', miRol: miFamiliar.rol, idMiFamiliar: miFamiliar.id },
];

// Los recordatorios de hoy, el próximo y la alerta abierta los calcula cliente.ts.
export const hoy: Omit<Hoy, 'recordatorios' | 'proximo' | 'alertaAbiertaId'> = {
  persona: { id: 1, nombre: 'Marta', telefono: '+5491100000000' },
  estado: escenario.estado,
  ultimaCharla: haceDias(0, 10, 42),
  resumen:
    'Charló un rato a la mañana y contó que está tejiendo una bufanda para su nieta. ' +
    'Tomó la pastilla de las 9 cuando Eloy se la recordó.',
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

// Sin estadoHoy: lo calcula el servidor (acá, cliente.ts) según el día y la hora.
export const recordatorios: Recordatorio[] = [
  {
    id: 1,
    titulo: 'Pastilla de la presión',
    descripcion: 'la blanca, con agua',
    hora: '09:00',
    repeticion: 'diaria',
    diasSemana: null,
    fechaUnica: null,
  },
  {
    id: 2,
    titulo: 'Almorzar',
    descripcion: null,
    hora: '13:00',
    repeticion: 'diaria',
    diasSemana: null,
    fechaUnica: null,
  },
  {
    id: 3,
    titulo: 'Pastilla de la tarde',
    descripcion: null,
    hora: '18:00',
    repeticion: 'diaria',
    diasSemana: null,
    fechaUnica: null,
  },
  {
    id: 4,
    titulo: 'Turno con la doctora',
    descripcion: null,
    hora: '10:00',
    repeticion: 'una_vez',
    diasSemana: null,
    fechaUnica: diaSiguiente(),
  },
  {
    id: 5,
    titulo: 'Gimnasia',
    descripcion: null,
    hora: '17:00',
    repeticion: 'semanal',
    diasSemana: ['lunes', 'jueves'],
    fechaUnica: null,
  },
];

// Ordenados del más viejo al más nuevo.
export const mensajes: Mensaje[] = [
  {
    id: 1,
    direccion: 'de_familia',
    de: 'Juan',
    deFamiliarId: JUAN_ID,
    para: null,
    texto: 'Abuela, el sábado paso a verte con Sofi.',
    audioUrl: null,
    audioDuracionSeg: null,
    estado: 'leido',
    leidoEn: haceDias(5, 18, 40),
    creadoEn: haceDias(5, 18, 32),
  },
  {
    id: 2,
    direccion: 'a_familia',
    de: 'Marta',
    deFamiliarId: null,
    para: null,
    texto: 'Hoy fui a la plaza con Rosa y tomamos un café.',
    audioUrl: null,
    audioDuracionSeg: null,
    estado: 'entregado',
    leidoEn: null,
    creadoEn: haceDias(1, 17, 15),
  },
  {
    id: 3,
    direccion: 'de_familia',
    de: 'Vero',
    deFamiliarId: VERO_ID,
    para: null,
    texto: '¡Qué lindo, ma! Mandale saludos a Rosa.',
    audioUrl: null,
    audioDuracionSeg: null,
    estado: 'leido',
    leidoEn: haceDias(1, 17, 52),
    creadoEn: haceDias(1, 17, 30),
  },
  {
    id: 4,
    direccion: 'a_familia',
    de: 'Marta',
    deFamiliarId: null,
    para: null,
    texto: 'Decile a Vero que el domingo la espero a comer',
    // Todavía no hay audios reales: la burbuja se muestra pero no reproduce.
    audioUrl: 'ejemplo://audio/4',
    audioDuracionSeg: 4,
    estado: 'entregado',
    leidoEn: null,
    creadoEn: haceDias(0, 10, 45),
  },
  {
    id: 5,
    direccion: 'de_familia',
    de: 'Bautista',
    deFamiliarId: miFamiliar.id,
    para: null,
    texto: '¡Dale, mamá! Le aviso. Yo llevo las empanadas.',
    audioUrl: null,
    audioDuracionSeg: null,
    estado: 'leido',
    leidoEn: haceDias(0, 11, 20),
    creadoEn: haceDias(0, 11, 5),
  },
  {
    id: 6,
    direccion: 'de_familia',
    de: 'Bautista',
    deFamiliarId: miFamiliar.id,
    para: null,
    texto: '¿Te acordaste de la pastilla del mediodía?',
    audioUrl: null,
    audioDuracionSeg: null,
    estado: 'pendiente',
    leidoEn: null,
    creadoEn: haceDias(0, 12, 10),
  },
];
