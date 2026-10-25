// Contrato con el backend: los modelos de backend/app/schemas.py, con los mismos nombres pero en camelCase.
// Fechas siempre en UTC ISO 8601 (las de solo día, "2026-10-23"); la app las muestra en hora local.

export type Rol = 'administrador' | 'familiar';

// ---- Cuenta (TokensOut, UsuarioOut, PersonaResumenOut, RegistroIn)

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiraEnSeg: number;
};

export type Usuario = {
  id: number;
  nombre: string;
  apellido: string | null;
  email: string;
  telefono: string | null;
};

// Una persona que sigo (GET /personas) y mi lugar en su familia.
export type PersonaResumen = {
  id: number;
  nombre: string;
  miRol: Rol;
  idMiFamiliar: number;
};

// Lo que manda la app al crear la cuenta (RegistroIn también acepta apellido y teléfono).
export type RegistroNuevo = {
  nombre: string;
  email: string;
  password: string;
};

// VincularIn: con idPersona, Eloy pasa a ser de una persona que ya sigo (hace falta ser administrador);
// sin idPersona se crea una persona nueva con nombrePersona.
export type VinculacionNueva = {
  codigo: string;
  idPersona?: number;
  nombrePersona?: string;
};

// VincularOut
export type Vinculacion = {
  idPersona: number;
  idDispositivo: number;
};

// ---- Inicio (InicioOut, GET /personas/{id}/inicio)

export type EstadoPersona = 'bien' | 'atencion' | 'sin_conexion' | 'alerta';

// ResumenOut. Eloy lo escribe a las 21: durante el día viene el de ayer (esDeHoy = false).
export type Resumen = {
  fecha: string;
  texto: string;
  esDeHoy: boolean;
};

// RecordatorioCortoOut
export type RecordatorioCorto = {
  id: number;
  hora: string;
  titulo: string;
};

export type Inicio = {
  persona: { id: number; nombre: string };
  estado: EstadoPersona;
  idAlertaAbierta: number | null;
  ultimaCharla: string | null;
  resumen: Resumen | null;
  charlas: number;
  minutos: number;
  recordatoriosCumplidos: number;
  recordatoriosTotal: number;
  proximoRecordatorio: RecordatorioCorto | null;
};

// ---- Mensajes (MensajeOut, GET /personas/{id}/mensajes: los más nuevos primero, de a 50)

export type Mensaje = {
  id: number;
  direccion: 'de_familia' | 'a_familia';
  de: string | null;
  para: string | null;
  esMio: boolean;
  texto: string | null;
  audioUrl: string | null; // link firmado, vence en minutos
  audioDuracionSeg: number | null;
  estado: 'pendiente' | 'entregado' | 'leido';
  entregadoEn: string | null;
  leidoEn: string | null;
  creadoEn: string;
};

// ---- Recordatorios (RecordatorioIn, RecordatorioOut, RecordatoriosOut)

export type DiaSemana =
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes'
  | 'sabado'
  | 'domingo';

export type Repeticion = 'una_vez' | 'diaria' | 'semanal';

// RecordatorioIn: lo que manda la app para crear uno.
export type RecordatorioNuevo = {
  titulo: string;
  descripcion: string | null;
  hora: string; // "09:00", hora local de la persona
  repeticion: Repeticion;
  diasSemana: DiaSemana[] | null; // solo en los semanales
  fechaUnica: string | null; // "2026-10-23", solo en los de una vez
};

export type Recordatorio = {
  id: number;
  titulo: string;
  descripcion: string | null;
  hora: string;
  repeticion: Repeticion;
  diasSemana: DiaSemana[]; // vacía si no es semanal
  fechaUnica: string | null;
  creadoDesde: 'app' | 'eloy';
  sincronizado: boolean; // false = Eloy todavía no recibió el último cambio
  estado: 'sono' | 'pendiente' | null; // solo en la lista de hoy
  proximaFecha: string | null; // solo en próximos días
};

// GET /personas/{id}/recordatorios: el servidor ya los separa y los ordena.
export type Recordatorios = {
  fecha: string;
  hoy: Recordatorio[];
  proximos: Recordatorio[];
};

// ---- Familia (FamiliarOut, DispositivoOut, FamiliaOut, InvitacionOut)

export type Familiar = {
  id: number;
  nombre: string;
  parentesco: string | null;
  rol: Rol;
  recibeAlertas: boolean;
  prioridadAlerta: number | null;
  telefono: string | null;
  tieneCuenta: boolean;
  soyYo: boolean;
};

export type Dispositivo = {
  id: number;
  conectado: boolean;
  ultimaConexion: string | null;
  wifiSsid: string | null;
  volumen: number;
  versionSoftware: string | null;
  restaurando: boolean; // pidieron restaurarlo y Eloy todavía no lo hizo
};

// GET /personas/{id}/familia
export type Familia = {
  miRol: Rol;
  familiares: Familiar[];
  dispositivos: Dispositivo[];
};

// Se comparte el link; el código viaja adentro (y se muestra por si lo piden aparte).
export type Invitacion = {
  link: string;
  codigo: string;
  expiraEn: string;
};

// La respuesta 202 de volumen y restaurar: el pedido quedó anotado y Eloy lo hace en su próxima sincronización.
export type PedidoAEloy = {
  detalle: string;
};

// ---- Alertas (AlertaOut)

export type Alerta = {
  id: number;
  idPersona: number;
  persona: string;
  telefonoPersona: string | null;
  estado: 'abierta' | 'atendida' | 'cerrada';
  origen: 'voz' | 'pulsera' | 'pantalla';
  motivo: string | null;
  audioUrl: string | null; // link firmado, vence en minutos
  audioDuracionSeg: number | null;
  ocurridaEn: string;
  atendidaPor: string | null;
  atendidaPorMi: boolean;
  atendidaEn: string | null;
  cerradaEn: string | null;
  notaCierre: string | null;
  tambienAvisamosA: Array<{ nombre: string; parentesco: string | null }>;
};
