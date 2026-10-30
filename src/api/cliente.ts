// Todas las llamadas a la API pasan por acá: las pantallas usan `api` y no saben si hay backend.
// Con EXPO_PUBLIC_USAR_EJEMPLO=false van al backend de EXPO_PUBLIC_API_URL (rutas de backend/README.md);
// con true, o sin .env, devuelven los datos de ejemplo de simulado.ts.
import { pedir } from './http';
import { apiSimulada } from './simulado';
import type {
  Alerta,
  Familia,
  Inicio,
  Invitacion,
  Mensaje,
  PedidoAEloy,
  PersonaResumen,
  Recordatorio,
  Recordatorios,
  Tokens,
  Usuario,
  Vinculacion,
} from './tipos';

// Las mismas firmas que la simulada: si una cambia, TypeScript avisa en las dos.
const apiReal: typeof apiSimulada = {
  login: (email, password) => pedir<Tokens>('POST', '/auth/login', { cuerpo: { email, password }, conSesion: false }),

  // Crea la cuenta y ya deja la sesión abierta.
  registro: (datos) => pedir<Tokens>('POST', '/auth/registro', { cuerpo: datos, conSesion: false }),

  // Da de baja esta sesión en el servidor (204).
  logout: () => pedir<void>('POST', '/auth/logout'),

  usuario: () => pedir<Usuario>('GET', '/auth/yo'),

  // A quién sigo y con qué rol.
  personas: () => pedir<PersonaResumen[]>('GET', '/personas'),

  inicio: (idPersona) => pedir<Inicio>('GET', `/personas/${idPersona}/inicio`),

  // Los más nuevos primero, de a 50.
  mensajes: (idPersona) => pedir<Mensaje[]>('GET', `/personas/${idPersona}/mensajes`),

  // Quién lo manda sale de la sesión.
  enviarMensaje: (idPersona, texto) => pedir<Mensaje>('POST', `/personas/${idPersona}/mensajes`, { cuerpo: { texto } }),

  recordatorios: (idPersona) => pedir<Recordatorios>('GET', `/personas/${idPersona}/recordatorios`),

  crearRecordatorio: (idPersona, datos) =>
    pedir<Recordatorio>('POST', `/personas/${idPersona}/recordatorios`, { cuerpo: datos }),

  familia: (idPersona) => pedir<Familia>('GET', `/personas/${idPersona}/familia`),

  // 202: Eloy lo aplica en la próxima sincronización. Solo administradores.
  cambiarVolumen: (idDispositivo, volumen) =>
    pedir<PedidoAEloy>('PATCH', `/dispositivos/${idDispositivo}`, { cuerpo: { volumen } }),

  // 202, después del segundo aviso; 409 si ya hay una en curso.
  restaurarFabrica: (idDispositivo) =>
    pedir<PedidoAEloy>('POST', `/dispositivos/${idDispositivo}/restaurar`, { cuerpo: { confirmacion: 'RESTAURAR' } }),

  // Solo administradores. Sin datos: un familiar nuevo, con rol "familiar".
  invitarFamiliar: (idPersona) => pedir<Invitacion>('POST', `/personas/${idPersona}/invitaciones`, { cuerpo: {} }),

  // Quien vincula queda como administrador. 404 si el código no existe o venció, 429, 409.
  vincular: (datos) => pedir<Vinculacion>('POST', '/dispositivos/vincular', { cuerpo: datos }),

  // Devuelve la persona a la que me sumé. 404, 409 o 429.
  aceptarInvitacion: (codigo) => pedir<PersonaResumen>('POST', '/invitaciones/aceptar', { cuerpo: { codigo } }),

  alerta: (id) => pedir<Alerta>('GET', `/alertas/${id}`),

  // 409 si otro familiar ya la tomó: el texto dice quién.
  atenderAlerta: (id) => pedir<Alerta>('POST', `/alertas/${id}/atender`),
};

export const api = process.env.EXPO_PUBLIC_USAR_EJEMPLO === 'false' ? apiReal : apiSimulada;
