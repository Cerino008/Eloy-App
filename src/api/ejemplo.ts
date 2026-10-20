// Datos de ejemplo mientras no hay backend. Solo los lee cliente.ts, nunca las pantallas.
import type { EstadoPersona, Familiar, Hoy } from './tipos';

// Para probar otros casos en el teléfono: cambiá estos valores y guardá.
export const escenario = {
  estado: 'bien' as EstadoPersona,
  alertaAbierta: false,
  fallar: false, // las llamadas a la API fallan, para ver el estado de error
};

// Hoy a esa hora del teléfono, en UTC como lo manda la API.
function hoyALas(horas: number, minutos: number): string {
  const fecha = new Date();
  fecha.setHours(horas, minutos, 0, 0);
  return fecha.toISOString();
}

export const yo: Familiar = {
  id: 1,
  nombre: 'Bautista',
  parentesco: 'Hijo',
  rol: 'administrador',
  prioridadAlerta: 2,
  tieneCuenta: true,
};

export const hoy: Hoy = {
  persona: { id: 1, nombre: 'Marta', telefono: '+5491100000000' },
  estado: escenario.estado,
  ultimaCharla: hoyALas(10, 42),
  resumen:
    'Charló un rato a la mañana y contó que está tejiendo una bufanda para su nieta. ' +
    'Tomó la pastilla de las 9 cuando Eloy se la recordó.',
  charlas: 3,
  minutos: 18,
  recordatorios: { cumplidos: 2, total: 3 },
  proximo: { hora: '18:00', titulo: 'Pastilla de la presión' },
  alertaAbiertaId: escenario.alertaAbierta ? 1 : null,
};
