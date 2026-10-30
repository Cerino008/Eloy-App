// Una respuesta de error de la API: el código HTTP y el `detail` del backend como mensaje.
// Ej.: atender una alerta que ya tomó otro → estado 409, "Vero ya se está ocupando".
// Sin conexión (o si el servidor tarda más de 15 s) no hay respuesta: estado 0 y "No pudimos conectarnos...".
export class ErrorApi extends Error {
  readonly estado: number;

  constructor(estado: number, detalle: string) {
    super(detalle);
    this.name = 'ErrorApi';
    this.estado = estado;
  }
}

// Una respuesta del servidor que explica qué pasó (401, 404, 409, 429...): se muestra el texto tal cual.
// Sin conexión (0) y las fallas del servidor (5xx) no: la pantalla da su aviso de "revisá tu internet".
export function esRespuestaDelServidor(error: unknown): error is ErrorApi {
  return error instanceof ErrorApi && error.estado > 0 && error.estado < 500;
}

export function esConflicto(error: unknown): error is ErrorApi {
  return error instanceof ErrorApi && error.estado === 409;
}
