// Una respuesta de error de la API: el código HTTP y el `detail` del backend como mensaje.
// Ej.: atender una alerta que ya tomó otro → estado 409, "Vero ya se está ocupando".
// Sin conexión no hay respuesta: ese caso es un Error común, no un ErrorApi.
export class ErrorApi extends Error {
  readonly estado: number;

  constructor(estado: number, detalle: string) {
    super(detalle);
    this.name = 'ErrorApi';
    this.estado = estado;
  }
}

export function esConflicto(error: unknown): error is ErrorApi {
  return error instanceof ErrorApi && error.estado === 409;
}
