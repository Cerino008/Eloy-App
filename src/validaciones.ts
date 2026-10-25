// Lo que se revisa en el teléfono antes de mandar un formulario. Devuelven el aviso o null si está bien.

export const LARGO_MINIMO_PASSWORD = 8;

// Solo lo básico (algo@algo.algo); el resto lo revisa el servidor.
const FORMA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function errorEmail(email: string): string | null {
  const limpio = email.trim();
  if (!limpio) return 'Escribí tu email.';
  if (!FORMA_EMAIL.test(limpio)) return 'Revisá el email: tiene que ser como nombre@gmail.com.';
  return null;
}

export function errorNombre(nombre: string): string | null {
  return nombre.trim() ? null : 'Escribí tu nombre.';
}

// Al entrar alcanza con que la haya escrito; si está mal, lo dice el servidor.
export function errorPasswordLogin(password: string): string | null {
  return password ? null : 'Escribí tu contraseña.';
}

export function errorPasswordNueva(password: string): string | null {
  if (!password) return 'Elegí una contraseña.';
  if (password.length < LARGO_MINIMO_PASSWORD) {
    return `Tiene que tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`;
  }
  return null;
}
