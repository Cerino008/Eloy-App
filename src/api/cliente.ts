// Todas las llamadas a la API pasan por acá. Hoy devuelven los datos de ejemplo armados como lo haría
// el servidor; cuando el backend esté listo, solo cambia este archivo.
import { aFechaTexto, aHoraTexto } from '@/fechas';
import { DIAS_SEMANA, diaSemanaDe, suenaElDia } from '@/recordatorios';

import { ErrorApi } from './errores';
import * as ejemplo from './ejemplo';
import type {
  Alerta,
  Dispositivo,
  Familia,
  Inicio,
  Invitacion,
  Mensaje,
  PedidoAEloy,
  PersonaResumen,
  Recordatorio,
  RecordatorioNuevo,
  Recordatorios,
  RegistroNuevo,
  Tokens,
  Usuario,
  Vinculacion,
  VinculacionNueva,
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

// Eloy sincroniza cada 30 segundos: lo que se le pide (volumen, restaurar, un recordatorio nuevo) lo
// hace recién ahí. Con escenario.eloyNoSincroniza nunca lo hace.
const SINCRONIZACION_MS = 30 * 1000;

function enLaProximaSincronizacion(hacer: () => void) {
  if (!ejemplo.escenario.eloyNoSincroniza) setTimeout(hacer, SINCRONIZACION_MS);
}

// Hacen de base de datos: lo que se manda queda acá hasta que se recarga la app.
const mensajes: ejemplo.MensajeGuardado[] = [...ejemplo.mensajes];
const recordatorios: ejemplo.RecordatorioGuardado[] = [...ejemplo.recordatorios];
const familiares: ejemplo.FamiliarGuardado[] = [...ejemplo.familiares];
let dispositivo: Dispositivo | null = ejemplo.escenario.sinDispositivo ? null : { ...ejemplo.dispositivo };
let alerta: Alerta | null = ejemplo.escenario.alertaAbierta ? { ...ejemplo.alerta } : null;
let usuario: Usuario = { ...ejemplo.usuario };
// A quién sigue la cuenta. Una cuenta recién creada todavía no sigue a nadie, como en el backend.
let personas: PersonaResumen[] = ejemplo.escenario.sinPersonas ? [] : [...ejemplo.personas];
// Como limitador_vincular del backend: 5 códigos equivocados y hay que esperar.
let intentosVincular = 0;

// Como familiar_de() del backend: si no sigo a esa persona, para mí no existe.
function personaMia(idPersona: number): PersonaResumen {
  const persona = personas.find((p) => p.id === idPersona);
  if (!persona) throw new ErrorApi(404, 'Persona no encontrada');
  return persona;
}

function exigirAdmin(persona: PersonaResumen) {
  if (persona.miRol !== 'administrador') throw new ErrorApi(403, 'Solo un administrador puede hacer esto');
}

// El Eloy de la persona actual, si soy administrador (como _dispositivo_admin del backend).
function miDispositivo(idDispositivo: number): Dispositivo {
  if (!dispositivo || dispositivo.id !== idDispositivo || !personas[0]) throw new ErrorApi(404, 'Eloy no encontrado');
  exigirAdmin(personas[0]);
  return dispositivo;
}

function buscarAlerta(id: number): Alerta {
  if (!alerta || alerta.id !== id) throw new ErrorApi(404, 'Alerta no encontrada');
  return alerta;
}

function salidaMensaje(mensaje: ejemplo.MensajeGuardado, idMiFamiliar: number): Mensaje {
  const { idFamiliarEmisor, ...resto } = mensaje;
  return { ...resto, esMio: mensaje.direccion === 'de_familia' && idFamiliarEmisor === idMiFamiliar };
}

function salidaRecordatorio(
  recordatorio: ejemplo.RecordatorioGuardado,
  extra: Partial<Pick<Recordatorio, 'estado' | 'proximaFecha'>> = {},
): Recordatorio {
  return { ...recordatorio, estado: null, proximaFecha: null, ...extra };
}

// Como proxima_fecha() del backend, para "Próximos días" (no incluye hoy): los diarios y los semanales
// que suenan hoy ya están en "Hoy"; los de una vez, si su fecha es más adelante.
function proximaFecha(recordatorio: ejemplo.RecordatorioGuardado, ahora: Date): string | null {
  if (recordatorio.repeticion === 'una_vez') {
    return recordatorio.fechaUnica && recordatorio.fechaUnica > aFechaTexto(ahora) ? recordatorio.fechaUnica : null;
  }
  if (recordatorio.repeticion === 'semanal' && !recordatorio.diasSemana.includes(diaSemanaDe(ahora))) {
    for (let i = 1; i <= 7; i++) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i);
      if (recordatorio.diasSemana.includes(diaSemanaDe(fecha))) return aFechaTexto(fecha);
    }
  }
  return null;
}

// Como recordatorios_del_dia() del backend: los de hoy con "sonó" o "pendiente", por hora,
// y los de los próximos días, por fecha y hora.
function armarRecordatorios(ahora: Date): Recordatorios {
  const hora = aHoraTexto(ahora);
  const porHora = [...recordatorios].sort((a, b) => a.hora.localeCompare(b.hora) || a.id - b.id);
  const hoy = porHora
    .filter((recordatorio) => suenaElDia(recordatorio, ahora))
    .map((recordatorio) => salidaRecordatorio(recordatorio, { estado: recordatorio.hora <= hora ? 'sono' : 'pendiente' }));
  const proximos = porHora
    .map((recordatorio) => ({ recordatorio, fecha: proximaFecha(recordatorio, ahora) }))
    .filter((x): x is { recordatorio: ejemplo.RecordatorioGuardado; fecha: string } => x.fecha !== null)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.recordatorio.hora.localeCompare(b.recordatorio.hora))
    .map(({ recordatorio, fecha }) => salidaRecordatorio(recordatorio, { proximaFecha: fecha }));
  return { fecha: aFechaTexto(ahora), hoy, proximos };
}

// Las mismas reglas que _validar_regla() del backend.
function validarRecordatorio(datos: RecordatorioNuevo) {
  const dias = datos.diasSemana ?? [];
  if (datos.repeticion === 'semanal' && dias.length === 0) {
    throw new ErrorApi(422, 'Un recordatorio semanal necesita al menos un día');
  }
  if (datos.repeticion !== 'semanal' && dias.length > 0) {
    throw new ErrorApi(422, 'Los días solo van en recordatorios semanales');
  }
  if (datos.repeticion !== 'una_vez' && datos.fechaUnica !== null) {
    throw new ErrorApi(422, 'La fecha solo va en recordatorios de una vez');
  }
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

  // GET /personas/{id}/inicio
  inicio: (idPersona: number): Promise<Inicio> =>
    simularServidor(() => {
      personaMia(idPersona);
      const { hoy } = armarRecordatorios(new Date());
      const proximo = hoy.find((recordatorio) => recordatorio.estado === 'pendiente');
      // Como el backend: gana la alerta abierta; después, que Eloy no esté conectado.
      const abierta = alerta?.estado === 'abierta' ? alerta : null;
      const estado = abierta
        ? 'alerta'
        : !dispositivo?.conectado
          ? 'sin_conexion'
          : ejemplo.escenario.estado === 'alerta'
            ? 'bien'
            : ejemplo.escenario.estado;
      return {
        ...ejemplo.inicio,
        estado,
        idAlertaAbierta: abierta?.id ?? null,
        recordatoriosCumplidos: hoy.filter((recordatorio) => recordatorio.estado === 'sono').length,
        recordatoriosTotal: hoy.length,
        proximoRecordatorio: proximo ? { id: proximo.id, hora: proximo.hora, titulo: proximo.titulo } : null,
      };
    }),

  // GET /personas/{id}/mensajes: los más nuevos primero, de a 50 (los anteriores, con ?antes_de=).
  mensajes: (idPersona: number): Promise<Mensaje[]> =>
    simularServidor(() => {
      const persona = personaMia(idPersona);
      return [...mensajes]
        .sort((a, b) => Date.parse(b.creadoEn) - Date.parse(a.creadoEn) || b.id - a.id)
        .slice(0, 50)
        .map((mensaje) => salidaMensaje(mensaje, persona.idMiFamiliar));
    }),

  // POST /personas/{id}/mensajes. Quién lo manda sale de la sesión.
  enviarMensaje: (idPersona: number, texto: string): Promise<Mensaje> =>
    simularServidor(() => {
      const persona = personaMia(idPersona);
      const yo = familiares.find((familiar) => familiar.id === persona.idMiFamiliar);
      const nuevo: ejemplo.MensajeGuardado = {
        id: Math.max(0, ...mensajes.map((m) => m.id)) + 1,
        direccion: 'de_familia',
        de: yo?.nombre ?? usuario.nombre,
        idFamiliarEmisor: persona.idMiFamiliar,
        para: persona.nombre,
        texto: texto.trim(),
        audioUrl: null,
        audioDuracionSeg: null,
        estado: 'pendiente',
        entregadoEn: null,
        leidoEn: null,
        creadoEn: new Date().toISOString(),
      };
      mensajes.push(nuevo);
      return salidaMensaje(nuevo, persona.idMiFamiliar);
    }),

  // GET /personas/{id}/recordatorios
  recordatorios: (idPersona: number): Promise<Recordatorios> =>
    simularServidor(() => {
      personaMia(idPersona);
      return armarRecordatorios(new Date());
    }),

  // POST /personas/{id}/recordatorios. Queda sin sincronizar hasta que Eloy lo recibe.
  crearRecordatorio: (idPersona: number, datos: RecordatorioNuevo): Promise<Recordatorio> =>
    simularServidor(() => {
      personaMia(idPersona);
      validarRecordatorio(datos);
      const nuevo: ejemplo.RecordatorioGuardado = {
        ...datos,
        id: Math.max(0, ...recordatorios.map((r) => r.id)) + 1,
        diasSemana: DIAS_SEMANA.filter((dia) => datos.diasSemana?.includes(dia)),
        creadoDesde: 'app',
        sincronizado: false,
      };
      recordatorios.push(nuevo);
      enLaProximaSincronizacion(() => {
        nuevo.sincronizado = true;
      });
      return salidaRecordatorio(nuevo);
    }),

  // GET /personas/{id}/familia: los familiares, mi rol y el Eloy (o ninguno, si no está vinculado).
  familia: (idPersona: number): Promise<Familia> =>
    simularServidor(() => {
      const persona = personaMia(idPersona);
      // Como el backend: primero los administradores, después por orden de aviso.
      const ordenados = [...familiares].sort(
        (a, b) =>
          Number(b.rol === 'administrador') - Number(a.rol === 'administrador') ||
          (a.prioridadAlerta ?? Infinity) - (b.prioridadAlerta ?? Infinity) ||
          a.id - b.id,
      );
      return {
        miRol: persona.miRol,
        familiares: ordenados.map((familiar) => ({ ...familiar, soyYo: familiar.id === persona.idMiFamiliar })),
        dispositivos: dispositivo ? [dispositivo] : [],
      };
    }),

  // PATCH /dispositivos/{id} (solo administradores): responde 202 y Eloy lo aplica al sincronizar.
  cambiarVolumen: (idDispositivo: number, volumen: number): Promise<PedidoAEloy> =>
    simularServidor(() => {
      miDispositivo(idDispositivo);
      if (!Number.isInteger(volumen) || volumen < 0 || volumen > 100) {
        throw new ErrorApi(422, 'El volumen va de 0 a 100');
      }
      enLaProximaSincronizacion(() => {
        if (dispositivo?.id === idDispositivo) dispositivo = { ...dispositivo, volumen };
      });
      return { detalle: 'Eloy lo aplica en la próxima sincronización' };
    }),

  // POST /dispositivos/{id}/restaurar con la segunda confirmación. Responde 202: cuando Eloy sincroniza,
  // borra todo y queda desvinculado. Los familiares, mensajes y recordatorios siguen en el servidor.
  restaurarFabrica: (idDispositivo: number): Promise<PedidoAEloy> => {
    const cuerpo = { confirmacion: 'RESTAURAR' } as const;
    return simularServidor(() => {
      const actual = miDispositivo(idDispositivo);
      if (cuerpo.confirmacion !== 'RESTAURAR') throw new ErrorApi(422, 'Falta la confirmación');
      if (actual.restaurando) throw new ErrorApi(409, 'Ya hay una restauración en curso');
      dispositivo = { ...actual, restaurando: true };
      enLaProximaSincronizacion(() => {
        if (dispositivo?.id === idDispositivo) dispositivo = null;
      });
      return { detalle: 'Eloy se restaura en la próxima sincronización' };
    });
  },

  // POST /personas/{id}/invitaciones (solo administradores). Vence a los 7 días.
  invitarFamiliar: (idPersona: number): Promise<Invitacion> =>
    simularServidor(() => {
      exigirAdmin(personaMia(idPersona));
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
};
