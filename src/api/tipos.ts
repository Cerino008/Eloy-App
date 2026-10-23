// Contrato con el backend (borrador; ajustar con Héctor).
// Fechas siempre en UTC ISO 8601; la app las muestra en hora local.

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

export type Dispositivo = {
  conectado: boolean;
  ultimaConexion: string | null;
  wifiSsid: string | null;
  volumen: number;
  versionSoftware: string | null;
};

export type Alerta = {
  id: number;
  motivo: string | null;
  audioUrl: string | null;
  audioDuracionSeg: number | null;
  ocurridaEn: string;
  estado: 'abierta' | 'atendida' | 'cerrada';
  atendidaPor: string | null;
  tambienAvisados: Array<{ nombre: string; parentesco: string | null }>;
};
