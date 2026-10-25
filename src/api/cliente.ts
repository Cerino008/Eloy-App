// Todas las llamadas a la API pasan por acá. Hoy devuelven los datos de ejemplo;
// cuando el backend esté listo, solo cambia este archivo.
import { aHoraTexto } from '@/fechas';
import { suenaElDia } from '@/recordatorios';

import { ErrorApi } from './errores';
import * as ejemplo from './ejemplo';
import type {
  Alerta,
  Dispositivo,
  Familiar,
  Hoy,
  Invitacion,
  Mensaje,
  PersonaResumen,
  Recordatorio,
  RecordatorioNuevo,
  RegistroNuevo,
  Tokens,
  Usuario,
  Vinculacion,
  VinculacionNueva,
  Yo,
} from './tipos';

const DEMORA_MS = 700;

// Simula ir al servidor: tarda un poco y devuelve una copia, como un JSON nuevo.
// Si `datos` tira un error, la promesa falla, como una respuesta de error del servidor.
function simularServidor<T>(datos: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        if (ejemplo.escenario.fallar) throw new Error('No se pudo conectar con el servidor');
        const resultado = datos();
        resolve(resultado === undefined ? resultado : (JSON.parse(JSON.stringify(resultado)) as T));
      } catch (error) {
        reject(error);
      }
    }, DEMORA_MS);
  });
}

// Hacen de base de datos: lo que se manda queda acá hasta que se recarga la app.
const mensajes: Mensaje[] = [...ejemplo.mensajes];
const recordatorios: Recordatorio[] = [...ejemplo.recordatorios];
const familiares: Familiar[] = [...ejemplo.familiares];
let dispositivo: Dispositivo | null = ejemplo.escenario.sinDispositivo ? null : { ...ejemplo.dispositivo };
let alerta: Alerta | null = ejemplo.escenario.alertaAbierta ? { ...ejemplo.alerta } : null;
let usuario: Usuario = { ...ejemplo.usuario };
// A quién sigue la cuenta. Una cuenta recién creada todavía no sigue a nadie, como en el backend.
let personas: PersonaResumen[] = ejemplo.escenario.sinPersonas ? [] : [...ejemplo.personas];
// Como limitador_vincular del backend: 5 códigos equivocados y hay que esperar.
let intentosVincular = 0;

function buscarAlerta(id: number): Alerta {
  if (!alerta || alerta.id !== id) throw new ErrorApi(404, 'Alerta no encontrada');
  return alerta;
}

// Lo que va a calcular el servidor: si suena hoy y, en ese caso, si ya sonó.
function conEstadoDeHoy(recordatorio: Recordatorio, ahora: Date): Recordatorio {
  if (!suenaElDia(recordatorio, ahora)) return { ...recordatorio, estadoHoy: undefined };
  return { ...recordatorio, estadoHoy: recordatorio.hora <= aHoraTexto(ahora) ? 'sono' : 'pendiente' };
}

function recordatoriosDeHoy(ahora: Date): Recordatorio[] {
  return recordatorios
    .map((recordatorio) => conEstadoDeHoy(recordatorio, ahora))
    .filter((recordatorio) => recordatorio.estadoHoy !== undefined)
    .sort((a, b) => a.hora.localeCompare(b.hora));
}

const LETRAS_TOKEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Como token_aleatorio() del backend: texto al azar que sirve en un link.
function tokenAlAzar(largo: number): string {
  return Array.from({ length: largo }, () => LETRAS_TOKEN[Math.floor(Math.random() * LETRAS_TOKEN.length)]).join('');
}

// Como el backend: el access dura 15 minutos y el refresh, 30 días.
function tokensNuevos(): Tokens {
  return { accessToken: tokenAlAzar(40), refreshToken: tokenAlAzar(43), tokenType: 'bearer', expiraEnSeg: 15 * 60 };
}

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export const api = {
  // POST /auth/login. Cualquier email entra con una contraseña de 8 o más; el de prueba da 401.
  login: (email: string, password: string): Promise<Tokens> =>
    simularServidor(() => {
      const limpio = email.trim().toLowerCase();
      if (limpio === ejemplo.emailsDePrueba.incorrecto || password.length < 8) {
        throw new ErrorApi(401, 'Email o contraseña incorrectos');
      }
      usuario = { ...ejemplo.usuario, email: limpio };
      personas = ejemplo.escenario.sinPersonas ? [] : [...ejemplo.personas];
      return tokensNuevos();
    }),

  // POST /auth/registro: crea la cuenta y ya deja la sesión abierta.
  registro: (datos: RegistroNuevo): Promise<Tokens> =>
    simularServidor(() => {
      const email = datos.email.trim().toLowerCase();
      if (email === ejemplo.emailsDePrueba.registrado) throw new ErrorApi(409, 'Ya hay una cuenta con ese email');
      usuario = { id: usuario.id + 100, nombre: datos.nombre.trim(), apellido: null, email, telefono: null };
      personas = [];
      return tokensNuevos();
    }),

  // POST /auth/logout: el backend da de baja esta sesión.
  logout: (): Promise<void> => simularServidor(() => undefined),

  // GET /auth/yo
  usuario: (): Promise<Usuario> => simularServidor(() => usuario),

  // GET /personas: a quién sigo y con qué rol.
  personas: (): Promise<PersonaResumen[]> => simularServidor(() => personas),

  // La cuenta más su lugar en la familia. Por ahora la persona actual es la primera de la lista.
  yo: async (): Promise<Yo> => {
    const [cuenta, lista] = await Promise.all([api.usuario(), api.personas()]);
    const persona = lista[0];
    if (!persona) throw new ErrorApi(404, 'Todavía no seguís a ninguna persona');
    return { usuario: cuenta, persona };
  },

  hoy: (): Promise<Hoy> =>
    simularServidor(() => {
      const deHoy = recordatoriosDeHoy(new Date());
      const siguiente = deHoy.find((recordatorio) => recordatorio.estadoHoy === 'pendiente');
      // Como el backend: el estado es "alerta" mientras haya una alerta abierta, y solo entonces.
      const abierta = alerta?.estado === 'abierta' ? alerta : null;
      const estado = abierta ? 'alerta' : ejemplo.hoy.estado === 'alerta' ? 'bien' : ejemplo.hoy.estado;
      return {
        ...ejemplo.hoy,
        estado,
        alertaAbiertaId: abierta?.id ?? null,
        recordatorios: {
          cumplidos: deHoy.filter((recordatorio) => recordatorio.estadoHoy === 'sono').length,
          total: deHoy.length,
        },
        proximo: siguiente ? { hora: siguiente.hora, titulo: siguiente.titulo } : null,
      };
    }),

  // Del más viejo al más nuevo.
  mensajes: (): Promise<Mensaje[]> =>
    simularServidor(() => [...mensajes].sort((a, b) => Date.parse(a.creadoEn) - Date.parse(b.creadoEn))),

  enviarMensaje: (texto: string): Promise<Mensaje> =>
    simularServidor(() => {
      const nuevo: Mensaje = {
        id: Math.max(0, ...mensajes.map((m) => m.id)) + 1,
        direccion: 'de_familia',
        de: ejemplo.miFamiliar.nombre,
        deFamiliarId: ejemplo.miFamiliar.id,
        para: null,
        texto,
        audioUrl: null,
        audioDuracionSeg: null,
        estado: 'pendiente',
        leidoEn: null,
        creadoEn: new Date().toISOString(),
      };
      mensajes.push(nuevo);
      return nuevo;
    }),

  // Ordenados por hora; los que suenan hoy traen estadoHoy.
  recordatorios: (): Promise<Recordatorio[]> =>
    simularServidor(() => {
      const ahora = new Date();
      return recordatorios
        .map((recordatorio) => conEstadoDeHoy(recordatorio, ahora))
        .sort((a, b) => a.hora.localeCompare(b.hora));
    }),

  crearRecordatorio: (datos: RecordatorioNuevo): Promise<Recordatorio> =>
    simularServidor(() => {
      const nuevo: Recordatorio = { id: Math.max(0, ...recordatorios.map((r) => r.id)) + 1, ...datos };
      recordatorios.push(nuevo);
      return conEstadoDeHoy(nuevo, new Date());
    }),

  familiares: (): Promise<Familiar[]> => simularServidor(() => familiares),

  // null: todavía no hay un Eloy vinculado.
  dispositivo: (): Promise<Dispositivo | null> => simularServidor(() => dispositivo),

  // En el backend: PATCH /dispositivos/{id}, responde 202 y Eloy lo aplica en la próxima sincronización.
  cambiarVolumen: (volumen: number): Promise<Dispositivo> =>
    simularServidor(() => {
      if (!dispositivo) throw new Error('No hay un Eloy vinculado');
      dispositivo = { ...dispositivo, volumen: Math.min(100, Math.max(0, Math.round(volumen))) };
      return dispositivo;
    }),

  // POST /personas/{id}/invitaciones (solo administradores). Vence a los 7 días.
  invitarFamiliar: (): Promise<Invitacion> =>
    simularServidor(() => {
      const codigo = tokenAlAzar(32);
      return {
        link: `https://eloy.app/invitacion?codigo=${codigo}`,
        codigo,
        expiraEn: new Date(Date.now() + SIETE_DIAS_MS).toISOString(),
      };
    }),

  // POST /dispositivos/vincular. Quien vincula queda como administrador.
  // La simulación sigue con los datos de Marta aunque escriban otro nombre, y deja usar el código
  // válido más de una vez (en el backend, una vez usado da 404).
  vincular: (datos: VinculacionNueva): Promise<Vinculacion> =>
    simularServidor(() => {
      if (intentosVincular >= 5) throw new ErrorApi(429, 'Demasiados intentos. Probá en 15 minutos.');
      if (datos.codigo.trim().toUpperCase() !== ejemplo.codigosDePrueba.vinculacion) {
        intentosVincular += 1;
        throw new ErrorApi(404, 'Código inválido o vencido. Pedile uno nuevo a Eloy.');
      }
      let persona: PersonaResumen;
      if (datos.idPersona !== undefined) {
        const existente = personas.find((p) => p.id === datos.idPersona);
        if (!existente) throw new ErrorApi(404, 'Persona no encontrada');
        if (existente.miRol !== 'administrador') throw new ErrorApi(403, 'Solo un administrador puede hacer esto');
        persona = existente;
      } else {
        persona = { ...ejemplo.personas[0], miRol: 'administrador' };
        personas = [...personas, persona];
      }
      intentosVincular = 0;
      dispositivo = { ...ejemplo.dispositivo, conectado: true, ultimaConexion: new Date().toISOString() };
      return { idPersona: persona.id, idDispositivo: 1 };
    }),

  // POST /invitaciones/aceptar: devuelve la persona a la que me sumé.
  aceptarInvitacion: (codigo: string): Promise<PersonaResumen> =>
    simularServidor(() => {
      if (codigo !== ejemplo.codigosDePrueba.invitacion) {
        throw new ErrorApi(404, 'La invitación no existe, ya se usó o venció');
      }
      const persona = ejemplo.personas[0];
      if (personas.some((p) => p.id === persona.id)) throw new ErrorApi(409, 'Ya sos parte de esta familia');
      personas = [...personas, persona];
      return persona;
    }),

  alerta: (id: number): Promise<Alerta> => simularServidor(() => buscarAlerta(id)),

  // Como POST /alertas/{id}/atender: si otro ya la tomó, 409 con quién se ocupa.
  atenderAlerta: (id: number): Promise<Alerta> =>
    simularServidor(() => {
      let actual = buscarAlerta(id);
      if (actual.estado === 'abierta' && ejemplo.escenario.atendidaPorOtro) {
        // Vero tocó "Ya me ocupo yo" un instante antes.
        actual = { ...actual, estado: 'atendida', atendidaPor: 'Vero', atendidaPorMi: false, atendidaEn: new Date().toISOString() };
        alerta = actual;
      }
      if (actual.estado !== 'abierta') {
        throw new ErrorApi(409, actual.atendidaPor ? `${actual.atendidaPor} ya se está ocupando` : 'La alerta ya no está abierta');
      }
      alerta = {
        ...actual,
        estado: 'atendida',
        atendidaPor: ejemplo.miFamiliar.nombre,
        atendidaPorMi: true,
        atendidaEn: new Date().toISOString(),
      };
      return alerta;
    }),

  // Simula el borrado: sin Eloy, sin charlas, sin recordatorios y la familia solo con quien lo pidió.
  restaurarFabrica: (): Promise<void> =>
    simularServidor(() => {
      dispositivo = null;
      mensajes.length = 0;
      recordatorios.length = 0;
      familiares.splice(0, familiares.length, ejemplo.miFamiliar);
    }),
};
