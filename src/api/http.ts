// Todo lo que va al backend pasa por acá: arma la URL, manda el token, renueva la sesión cuando vence
// y convierte las respuestas de error en ErrorApi con un texto que se puede mostrar.
import { ErrorApi } from './errores';
import { avisarSesionVencida, borrarSesion, guardarSesion, leerSesion } from './sesionGuardada';
import type { Tokens } from './tipos';

// Viene de .env: Expo mete las EXPO_PUBLIC_* en la app al compilar.
const URL_API = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
const ESPERA_MAXIMA_MS = 15 * 1000;
// Se renueva un poco antes de que venza, para no mandar un token que vence en el camino.
const MARGEN_VENCIMIENTO_MS = 30 * 1000;

export const SIN_CONEXION = 'No pudimos conectarnos. Revisá tu internet.';
const SESION_VENCIDA = 'Tu sesión venció. Volvé a entrar.';

type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type ValorDeUrl = string | number | boolean | null | undefined;

type Opciones = {
  cuerpo?: unknown; // va en camelCase, como los modelos del backend
  // Parámetros de la URL: se escriben en camelCase y viajan en snake_case (antesDe → ?antes_de=),
  // porque no son parte de los modelos y el backend no los convierte.
  consulta?: Record<string, ValorDeUrl>;
  conSesion?: boolean; // false en login, registro y refresh: van sin token
};

type Respuesta = { estado: number; datos: unknown };

// "antesDe" → "antes_de"
function aSnake(texto: string): string {
  return texto.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);
}

// "id_alerta" → "idAlerta"
function aCamelTexto(texto: string): string {
  return texto.replace(/_([a-z0-9])/g, (_, letra: string) => letra.toUpperCase());
}

// Pasa a camelCase las claves de un objeto y de los que tenga adentro. Es para los `data` de los push,
// que el backend manda en snake_case: { tipo, id_alerta, id_persona } → { tipo, idAlerta, idPersona }.
// Las respuestas de la API ya vienen en camelCase.
export function aCamel<T = unknown>(dato: unknown): T {
  if (Array.isArray(dato)) return dato.map((d) => aCamel(d)) as T;
  if (dato !== null && typeof dato === 'object') {
    return Object.fromEntries(Object.entries(dato).map(([clave, valor]) => [aCamelTexto(clave), aCamel(valor)])) as T;
  }
  return dato as T;
}

function armarUrl(ruta: string, consulta: Record<string, ValorDeUrl> = {}): string {
  if (!URL_API) throw new Error('Falta EXPO_PUBLIC_API_URL en .env (ver .env.example)');
  const parametros = Object.entries(consulta)
    .filter(([, valor]) => valor !== undefined && valor !== null)
    .map(([clave, valor]) => `${encodeURIComponent(aSnake(clave))}=${encodeURIComponent(String(valor))}`);
  return `${URL_API}${ruta}${parametros.length > 0 ? `?${parametros.join('&')}` : ''}`;
}

function leerJson(texto: string): unknown {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return texto; // una página de error del proxy, por ejemplo
  }
}

async function enviar(metodo: Metodo, url: string, cuerpo: unknown, token: string | null): Promise<Respuesta> {
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), ESPERA_MAXIMA_MS);
  try {
    const respuesta = await fetch(url, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: control.signal,
    });
    // El cuerpo también se lee dentro de los 15 segundos.
    return { estado: respuesta.status, datos: leerJson(await respuesta.text()) };
  } catch {
    // Sin red, un servidor que no contesta o más de 15 s: para quien usa la app es lo mismo.
    throw new ErrorApi(0, SIN_CONEXION);
  } finally {
    clearTimeout(limite);
  }
}

// El `detail` del backend ya está escrito para la familia. Si no hay (o es la lista de campos de un
// 422 de FastAPI, en inglés), un texto según el código.
function textoDeError({ estado, datos }: Respuesta): string {
  const detalle = datos !== null && typeof datos === 'object' ? (datos as { detail?: unknown }).detail : undefined;
  if (typeof detalle === 'string' && detalle.trim() !== '') return detalle;
  if (estado === 401) return SESION_VENCIDA;
  if (estado === 422) return 'Revisá los datos: hay algo que no está bien.';
  if (estado === 429) return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
  if (estado >= 500) return 'El servidor tuvo un problema. Probá de nuevo en un rato.';
  return 'No pudimos hacerlo. Probá de nuevo.';
}

async function cerrarSesionVencida(): Promise<void> {
  await borrarSesion();
  avisarSesionVencida();
}

// POST /auth/refresh. El refresh rota (el viejo deja de servir), así que si fallan varias llamadas
// juntas se hace uno solo y todas esperan ese: un segundo refresh con el token viejo daría 401.
let renovando: Promise<string | null> | null = null;

function renovarSesion(tokenUsado: string): Promise<string | null> {
  renovando ??= renovar(tokenUsado).finally(() => {
    renovando = null;
  });
  return renovando;
}

async function renovar(tokenUsado: string): Promise<string | null> {
  const sesion = await leerSesion();
  if (!sesion) return null;
  // Otra llamada ya la renovó mientras esta esperaba la respuesta.
  if (sesion.accessToken !== tokenUsado) return sesion.accessToken;
  const respuesta = await enviar('POST', armarUrl('/auth/refresh'), { refreshToken: sesion.refreshToken }, null);
  if (respuesta.estado === 200) {
    const tokens = respuesta.datos as Tokens;
    await guardarSesion(tokens);
    return tokens.accessToken;
  }
  if (respuesta.estado === 401 || respuesta.estado === 422) {
    // Vencido, revocado (cerraron todas las sesiones) o ya usado: hay que volver a entrar.
    await cerrarSesionVencida();
    return null;
  }
  // Una falla del servidor no es culpa de la sesión: no se cierra.
  throw new ErrorApi(respuesta.estado, textoDeError(respuesta));
}

async function tokenVigente(): Promise<string | null> {
  const sesion = await leerSesion();
  if (!sesion) return null;
  if (Date.now() < sesion.venceEn - MARGEN_VENCIMIENTO_MS) return sesion.accessToken;
  return renovarSesion(sesion.accessToken);
}

export async function pedir<T>(metodo: Metodo, ruta: string, opciones: Opciones = {}): Promise<T> {
  const { cuerpo, consulta, conSesion = true } = opciones;
  const url = armarUrl(ruta, consulta);
  let token = conSesion ? await tokenVigente() : null;
  if (conSesion && !token) throw new ErrorApi(401, SESION_VENCIDA);

  let respuesta = await enviar(metodo, url, cuerpo, token);
  // 401 con token: venció antes de lo previsto (o lo revocaron). Un refresh y se reintenta una vez;
  // con 401 el servidor no hizo nada, así que reintentar un POST es seguro.
  if (respuesta.estado === 401 && token) {
    token = await renovarSesion(token);
    if (!token) throw new ErrorApi(401, SESION_VENCIDA);
    respuesta = await enviar(metodo, url, cuerpo, token);
  }
  if (respuesta.estado >= 400) throw new ErrorApi(respuesta.estado, textoDeError(respuesta));
  return respuesta.datos as T;
}
