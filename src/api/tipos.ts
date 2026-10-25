// Contrato con el backend (borrador; ajustar con Héctor).
// Fechas siempre en UTC ISO 8601; la app las muestra en hora local.

// ---- Cuenta (TokensOut, UsuarioOut, PersonaResumenOut y RegistroIn de schemas.py, en camelCase)

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
  miRol: 'administrador' | 'familiar';
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

// Quién usa la app: la cuenta y su lugar en la familia de la persona actual.
export type Yo = {
  usuario: Usuario;
  persona: PersonaResumen;
};

// ---- Pantallas

export type EstadoPersona = 'bien' | 'atencion' | 'sin_conexion' | 'alerta';

export type Hoy = {
  persona: { id: number; nombre: string; telefono: string | null };
  estado: EstadoPersona;
  ultimaCharla: string | null;
  resumen: string | null;
  charlas: number;
  minutos: number;
  recordatorios: { cumplidos: number; total: number };
  proximo: { hora: string; titulo: string } | null;
  alertaAbiertaId: number | null;
};

export type Mensaje = {
  id: number;
  direccion: 'de_familia' | 'a_familia';
  de: string;
  deFamiliarId: number | null; // null = lo mandó la persona (Marta). Pendiente de pedírselo a Héctor.
  para: string | null; // null = toda la familia
  texto: string | null;
  audioUrl: string | null;
  audioDuracionSeg: number | null;
  estado: 'pendiente' | 'entregado' | 'leido';
  leidoEn: string | null;
  creadoEn: string;
};

export type DiaSemana =
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes'
  | 'sabado'
  | 'domingo';

export type Recordatorio = {
  id: number;
  titulo: string;
  descripcion: string | null;
  hora: string; // "09:00", hora local de la persona
  repeticion: 'una_vez' | 'diaria' | 'semanal';
  diasSemana: DiaSemana[] | null;
  fechaUnica: string | null; // "2026-10-23"
  estadoHoy?: 'sono' | 'pendiente';
};

// Lo que manda la app para crear uno: el servidor pone el id y calcula estadoHoy.
export type RecordatorioNuevo = Omit<Recordatorio, 'id' | 'estadoHoy'>;

export type Familiar = {
  id: number;
  nombre: string;
  parentesco: string | null;
  rol: 'administrador' | 'familiar';
  prioridadAlerta: number | null;
  tieneCuenta: boolean;
};

// InvitacionOut: se comparte el link; el código viaja adentro (y se muestra por si lo piden aparte).
export type Invitacion = {
  link: string;
  codigo: string;
  expiraEn: string;
};

export type Dispositivo = {
  conectado: boolean;
  ultimaConexion: string | null;
  wifiSsid: string | null;
  volumen: number;
  versionSoftware: string | null;
};

// AlertaOut de backend/app/schemas.py, en camelCase.
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
