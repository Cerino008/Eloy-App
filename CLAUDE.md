# Eloy — App de la familia

App móvil (iOS y Android) para los familiares de una persona mayor que usa **Eloy**, un robot compañero con IA que vive en su casa (Raspberry Pi). La familia ve cómo está la persona, le manda mensajes que Eloy lee en voz alta, carga recordatorios y recibe alertas si pide ayuda.

- La app la desarrolla Bautista. El backend (API + base MySQL/MariaDB) lo hace Héctor y está en `backend/` de este repo. **Es de Héctor: no tocar nada en `backend/`**; solo leerlo como referencia.
- La app **nunca** habla con la Raspberry: todo pasa por la API del backend.
- Texto de la app en **español rioplatense** (voseo: "Escribile", "Agregá"). Tono cercano, nada técnico.

## Stack

- Expo **SDK 58** (React Native 0.88, React 19.3) + **TypeScript** (modo estricto). Con la API estricta de tipos de React Native, las refs usan tipos de instancia (`FlatListInstance`, `ViewInstance`…)
- **Expo Router** para la navegación (carpeta `app/`)
- TanStack Query para pedir datos a la API
- expo-secure-store (sesión), expo-camera (QR), expo-notifications (push, etapa 3), expo-audio (audios)
- Se prueba con **Expo Go** en un iPhone (`npx expo start`). No agregar librerías que no funcionen en Expo Go sin avisar.
- Instalar dependencias con `npx expo install` (elige versiones compatibles con el SDK).

## Estructura

```
app/
  _layout.tsx              carga la fuente y los providers
  (tabs)/_layout.tsx       barra con 4 pestañas
  (tabs)/index.tsx         Inicio
  (tabs)/mensajes.tsx
  (tabs)/recordatorios.tsx
  (tabs)/familia.tsx
  alerta/[id].tsx          pantalla completa, encima de las pestañas
  vincular.tsx             QR (expo-camera) o código a mano; desde la bienvenida pide el nombre de la persona
  nuevo-recordatorio.tsx   modal
  login.tsx                sin sesión
  registro.tsx             sin sesión
  bienvenida.tsx           con sesión pero sin personas: "Vincular a Eloy" / "Tengo una invitación"
  invitacion.tsx           aceptar una invitación; acepta ?codigo= en la ruta
src/
  tema.ts                  colores, tipografía, espacios (única fuente de estilos)
  sesion.tsx               tokens en expo-secure-store, SesionProvider y useSesion()
  validaciones.ts          avisos de los formularios (email, contraseña…)
  codigos.ts               alfabeto del código de Eloy (el de backend/app/seguridad.py) y código dentro de un link
  componentes/             Tarjeta, Boton, Avatar, BurbujaMensaje, FilaRecordatorio, PuntoEstado...
  api/tipos.ts             contrato con el backend
  api/ejemplo.ts           datos de ejemplo (Marta, Vero, Juan)
  api/cliente.ts           funciones api.xxx(); hoy devuelven ejemplos, después llaman a la API
backend/                   API de Héctor (no tocar). Contrato: app/schemas.py y README.md
```

Regla: las pantallas **no** leen `ejemplo.ts` directo, siempre usan `cliente.ts`. Cuando el backend esté listo solo cambia `cliente.ts`.

### Flujo de entrada

`app/_layout.tsx` decide qué se puede abrir con `Stack.Protected` (cada grupo con `redirectTo`; sin eso Expo Router elige la primera ruta libre en su propio orden):

- Cargando la sesión (o las personas): `Cargando`.
- Sin sesión: `login` y `registro`.
- Con sesión y sin personas (ej. cuenta recién creada): `bienvenida` e `invitacion`.
- Con sesión y personas: las pestañas, `alerta/[id]` y `nuevo-recordatorio`. `vincular`, con cualquier sesión.

La renovación del token (`POST /auth/refresh`, con rotación) va en `tokenDeAcceso()` de `src/sesion.tsx`, al conectar el backend.

## Diseño

Referencias en `docs/diseno/` (1-inicio.png … 6-familia.png). Respetarlas.

| Token | Valor |
|---|---|
| Fondo | crema `#F4F1EA` |
| Texto principal / barras | azul petróleo `#1F3A4D` |
| Texto secundario | `#4E5F6C` |
| Acción principal | naranja ámbar `#F28C28` con texto `#1F3A4D` (un solo botón naranja por pantalla) |
| Estado bien / acento | teal `#3E9A8A` (fondos suaves `#E3F1EE`) |
| Alerta | rojo `#B3302F`: para emergencias y para errores de formulario (texto chico con ícono y borde del campo). Nunca como fondo ni botón fuera de Alerta |
| Tarjetas | blancas, esquinas 16, sin sombras fuertes |
| Tipografía | Plus Jakarta Sans (`@expo-google-fonts/plus-jakarta-sans`): títulos 28 bold, cuerpo 17, nunca menos de 13 |
| Toque | áreas táctiles de 44 px como mínimo |

Accesibilidad: `accessibilityLabel` en botones que son solo ícono; contraste suficiente. Los usuarios son hijos de 35 a 55 años: claridad antes que adornos.

## Pantallas

1. **Inicio**: estado ("Marta está bien" / atención / sin conexión / alerta), última charla, resumen del día, 3 números (charlas, minutos, recordatorios cumplidos "2/3"), próximo recordatorio, botón "Mandarle un mensaje".
2. **Mensajes**: chat. Mensajes de Marta (pueden traer audio) a la izquierda; los de la familia a la derecha con "Eloy se lo lee en un momento" / "Eloy ya se lo leyó · 11:20".
3. **Recordatorios**: "Hoy" con Sonó / Pendiente y "Próximos días"; botón "Agregar recordatorio" (todos los días / algunos días / una sola vez).
4. **Alerta**: pantalla roja completa: qué dijo, audio, "También avisamos a…", "Llamar a Marta", "Ya me ocupo yo".
5. **Vincular a Eloy**: escanear el QR de la pantalla de Eloy o escribir el código.
6. **Familia**: familiares con rol y prioridad, "Invitar a un familiar", tarjeta de Eloy (conectado, WiFi, volumen, versión), "Restaurar de fábrica" con doble confirmación.

## Contrato con el backend

El contrato real es el del backend: **`backend/app/schemas.py`** (qué entra y sale de cada endpoint) y **`backend/README.md`** (rutas, códigos de respuesta y notas para la app). Base de datos documentada en `docs/Eloy_Diagnostico_y_Base_de_Datos_v2.pdf`. Fechas de la API siempre en **UTC ISO 8601**; la app las muestra en hora local.

Los tipos de `src/api/tipos.ts` son los de `schemas.py` con los mismos nombres pero en camelCase (ej. `tambien_avisamos_a` → `tambienAvisamosA`). `cliente.ts` simula las respuestas como el servidor (orden, separaciones, `esMio`, `soyYo`…): las pantallas no calculan nada de eso.

Las rutas de una persona llevan su id (`/personas/{id}/inicio`, `/mensajes`, `/recordatorios`, `/familia`): las pantallas lo toman de `usePersonaActual()` (por ahora, la primera de `GET /personas`) y las consultas lo llevan en la clave (`consultas.inicio(idPersona)`).

**La URL va en snake_case aunque el cuerpo vaya en camelCase:** los parámetros (`?antes_de=`, `?limite=`, `?id_persona=`, `?todas=`) no son parte de los modelos del backend y no se convierten.

```ts
type Rol = 'administrador' | 'familiar';

// Cuenta
type Tokens = { accessToken; refreshToken; tokenType; expiraEnSeg };                 // TokensOut
type Usuario = { id; nombre; apellido; email; telefono };                             // UsuarioOut (GET /auth/yo)
type PersonaResumen = { id; nombre; miRol: Rol; idMiFamiliar };                       // GET /personas
type RegistroNuevo = { nombre; email; password };                                     // RegistroIn
type VinculacionNueva = { codigo; idPersona?; nombrePersona? };                       // VincularIn
type Vinculacion = { idPersona; idDispositivo };                                      // VincularOut

// Inicio: GET /personas/{id}/inicio
type Inicio = {                                                                       // InicioOut
  persona: { id; nombre };
  estado: 'bien' | 'atencion' | 'sin_conexion' | 'alerta';
  idAlertaAbierta: number | null;
  ultimaCharla: string | null;
  resumen: { fecha; texto; esDeHoy } | null;   // de 21 a 21: durante el día viene el de ayer
  charlas; minutos;
  recordatoriosCumplidos; recordatoriosTotal;
  proximoRecordatorio: { id; hora; titulo } | null;
};

// Mensajes: GET /personas/{id}/mensajes (más nuevos primero, de a 50) y POST
type Mensaje = {                                                                      // MensajeOut
  id; direccion: 'de_familia' | 'a_familia'; de: string | null; para: string | null;
  esMio: boolean; texto: string | null; audioUrl: string | null; audioDuracionSeg: number | null;
  estado: 'pendiente' | 'entregado' | 'leido'; entregadoEn; leidoEn; creadoEn;
};

// Recordatorios: GET /personas/{id}/recordatorios y POST
type RecordatorioNuevo = { titulo; descripcion; hora; repeticion; diasSemana: DiaSemana[] | null; fechaUnica }; // RecordatorioIn
type Recordatorio = {                                                                 // RecordatorioOut
  id; titulo; descripcion; hora: string /* "09:00" */; repeticion: 'una_vez' | 'diaria' | 'semanal';
  diasSemana: DiaSemana[] /* vacía si no es semanal */; fechaUnica: string | null;
  creadoDesde: 'app' | 'eloy'; sincronizado: boolean;
  estado: 'sono' | 'pendiente' | null;   // solo en `hoy`
  proximaFecha: string | null;           // solo en `proximos`
};
type Recordatorios = { fecha; hoy: Recordatorio[]; proximos: Recordatorio[] };        // RecordatoriosOut

// Familia: GET /personas/{id}/familia
type Familiar = { id; nombre; parentesco; rol: Rol; recibeAlertas; prioridadAlerta; telefono; tieneCuenta; soyYo }; // FamiliarOut
type Dispositivo = { id; conectado; ultimaConexion; wifiSsid; volumen; versionSoftware; restaurando };              // DispositivoOut
type Familia = { miRol: Rol; familiares: Familiar[]; dispositivos: Dispositivo[] };                                 // FamiliaOut
type Invitacion = { link; codigo; expiraEn };                                         // InvitacionOut
type PedidoAEloy = { detalle };                    // la respuesta 202 de volumen y restaurar

// Alertas
type Alerta = {                                                                       // AlertaOut
  id; idPersona; persona; telefonoPersona; estado: 'abierta' | 'atendida' | 'cerrada';
  origen; motivo; audioUrl; audioDuracionSeg; ocurridaEn; atendidaPor; atendidaPorMi;
  atendidaEn; cerradaEn; notaCierre; tambienAvisamosA: Array<{ nombre; parentesco }>;
};
```

### Ya resuelto en el backend

Lo que la app simula en `src/api/cliente.ts` igual que el backend; al conectar, seguir lo del backend:

- **Quién soy:** `GET /auth/yo` devuelve el usuario (`UsuarioOut`). El rol y cuál familiar soy vienen en `GET /personas` (`mi_rol`, `id_mi_familiar`) y en `GET /personas/{id}/familia` (`mi_rol`, `soy_yo`).
- **Invitaciones:** `POST /personas/{id}/invitaciones` (solo administradores) devuelve `{ link, codigo, expira_en }`. El código viaja dentro del link: la app comparte el link (y el código aparte, por si lo piden). En la rama `backend-correcciones` pasa a **8 caracteres** (se acepta en minúscula; 429 después de 5 códigos equivocados en 15 minutos): al mergearla, `LARGO_MINIMO_INVITACION` de `src/codigos.ts` pasa de 10 a 8.
- **Volumen:** `PATCH /dispositivos/{id}` con `{ volumen }` responde **202**: Eloy lo aplica en la próxima sincronización (cada 30 s). Solo administradores (los demás ven el volumen sin slider). La app no lo da por hecho: muestra "Eloy lo cambia en la próxima sincronización" y recarga cada 15 s con la pantalla a la vista; a los 2 minutos deja de recargar y avisa que Eloy puede estar sin conexión.
- **Restaurar de fábrica:** `POST /dispositivos/{id}/restaurar` con `{"confirmacion": "RESTAURAR"}` (la app lo manda tras el segundo aviso); responde 202 y 409 si ya hay una en curso. Mientras `restaurando` es verdadero, Familia lo dice en vez del botón; cuando Eloy sincroniza queda desvinculado (los familiares, mensajes y recordatorios siguen en el servidor).
- **Vincular:** `POST /dispositivos/vincular` responde el mismo 404 para un código mal escrito o vencido (la app muestra un solo texto), 429 tras 5 intentos y 409 si ese Eloy ya está vinculado. Con `id_persona` hace falta ser administrador: en Familia, "Vincular a Eloy" solo lo ven ellos.
- **Aceptar invitación:** `POST /invitaciones/aceptar` devuelve `PersonaResumenOut`; 404 si no existe, se usó o venció, y 409 si ya sos parte de la familia.
- **Atender una alerta:** `POST /alertas/{id}/atender` responde **409** si otro familiar ya la tomó; el `detail` dice quién ("Vero ya se está ocupando").

### Pendiente con Héctor

- **camelCase:** hecho en la rama `backend-correcciones` (junto con `para: null` para los mensajes a toda la familia y el código de invitación de 8): falta que Héctor la revise y la mergee. Los `data` de los push (`id_alerta`, `id_persona`…) siguen en snake_case: decidir con él.

### Pendiente en la app

- **Mensajes trae de a 50:** falta cargar los anteriores al scrollear hacia arriba (`GET /personas/{id}/mensajes?antes_de={id del más viejo}`).

## Cómo trabajar

- Una tarea por vez; mostrar el plan antes de crear muchos archivos.
- Componentes chicos y reutilizables; estilos siempre desde `tema.ts`.
- Después de cada cambio: `npx tsc --noEmit` sin errores.
- Commits chicos con mensaje en español que diga qué cambió.
- Después de cada commit, `git push`.
