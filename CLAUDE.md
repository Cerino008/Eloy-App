# Eloy — App de la familia

App móvil (iOS y Android) para los familiares de una persona mayor que usa **Eloy**, un robot compañero con IA que vive en su casa (Raspberry Pi). La familia ve cómo está la persona, le manda mensajes que Eloy lee en voz alta, carga recordatorios y recibe alertas si pide ayuda.

- La app la desarrolla Bautista. El backend (API + base MySQL/MariaDB) lo hace Héctor y está en `backend/` de este repo. **Es de Héctor: no tocar nada en `backend/`**; solo leerlo como referencia.
- La app **nunca** habla con la Raspberry: todo pasa por la API del backend.
- Texto de la app en **español rioplatense** (voseo: "Escribile", "Agregá"). Tono cercano, nada técnico.

## Stack

- Expo + React Native + **TypeScript** (modo estricto)
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
  vincular.tsx
  nuevo-recordatorio.tsx   modal
  login.tsx
src/
  tema.ts                  colores, tipografía, espacios (única fuente de estilos)
  componentes/             Tarjeta, Boton, Avatar, BurbujaMensaje, FilaRecordatorio, PuntoEstado...
  api/tipos.ts             contrato con el backend
  api/ejemplo.ts           datos de ejemplo (Marta, Vero, Juan)
  api/cliente.ts           funciones api.xxx(); hoy devuelven ejemplos, después llaman a la API
backend/                   API de Héctor (no tocar). Contrato: app/schemas.py y README.md
```

Regla: las pantallas **no** leen `ejemplo.ts` directo, siempre usan `cliente.ts`. Cuando el backend esté listo solo cambia `cliente.ts`.

## Diseño

Referencias en `docs/diseno/` (1-inicio.png … 6-familia.png). Respetarlas.

| Token | Valor |
|---|---|
| Fondo | crema `#F4F1EA` |
| Texto principal / barras | azul petróleo `#1F3A4D` |
| Texto secundario | `#4E5F6C` |
| Acción principal | naranja ámbar `#F28C28` con texto `#1F3A4D` (un solo botón naranja por pantalla) |
| Estado bien / acento | teal `#3E9A8A` (fondos suaves `#E3F1EE`) |
| Alerta | rojo `#B3302F`, solo para emergencias |
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

**Pantallas nuevas:** los tipos de `src/api/tipos.ts` siguen los nombres de `schemas.py` pero en camelCase (ej. `tambien_avisamos_a` → `tambienAvisamosA`, `atendida_por_mi` → `atendidaPorMi`).

Tipos que la app usa hoy (borrador anterior al backend; se alinean con `schemas.py` al conectar cada pantalla):

```ts
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
  deFamiliarId: number | null;  // null = lo mandó la persona. El backend manda es_mio: pasar a esMio al conectar
  para: string | null;          // null = toda la familia
  texto: string | null;
  audioUrl: string | null;
  audioDuracionSeg: number | null;
  estado: 'pendiente' | 'entregado' | 'leido';
  leidoEn: string | null;
  creadoEn: string;
};

export type Recordatorio = {
  id: number;
  titulo: string;
  descripcion: string | null;
  hora: string;                  // "09:00", hora local de la persona
  repeticion: 'una_vez' | 'diaria' | 'semanal';
  diasSemana: Array<'lunes'|'martes'|'miercoles'|'jueves'|'viernes'|'sabado'|'domingo'> | null;
  fechaUnica: string | null;     // "2026-10-23"
  estadoHoy?: 'sono' | 'pendiente';
};

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

// Ya alineado con AlertaOut de schemas.py (camelCase).
export type Alerta = {
  id: number;
  idPersona: number;
  persona: string;
  telefonoPersona: string | null;
  estado: 'abierta' | 'atendida' | 'cerrada';
  origen: 'voz' | 'pulsera' | 'pantalla';
  motivo: string | null;
  audioUrl: string | null;
  audioDuracionSeg: number | null;
  ocurridaEn: string;
  atendidaPor: string | null;
  atendidaPorMi: boolean;
  atendidaEn: string | null;
  cerradaEn: string | null;
  notaCierre: string | null;
  tambienAvisamosA: Array<{ nombre: string; parentesco: string | null }>;
};
```

### Ya resuelto en el backend

Lo que la app simula en `src/api/cliente.ts` y el backend ya tiene; al conectar, seguir lo del backend:

- **Mensajes:** `es_mio: bool` en `MensajeOut`, en vez de `deFamiliarId`.
- **Quién soy:** `GET /auth/yo` devuelve el usuario (`UsuarioOut`). El rol y cuál familiar soy vienen en `GET /personas/{id}/familia` (`mi_rol`, `soy_yo`).
- **Invitaciones:** `POST /personas/{id}/invitaciones` (solo administradores) devuelve `{ link, codigo, expira_en }`. El código es largo y viaja dentro del link: se comparte el link (hoy la app simula un código de 6).
- **Volumen:** `PATCH /dispositivos/{id}` con `{ volumen }` responde **202**: Eloy lo aplica en la próxima sincronización. Solo administradores.
- **Restaurar de fábrica:** `POST /dispositivos/{id}/restaurar` con `{"confirmacion": "RESTAURAR"}` (la app lo manda tras el segundo aviso); responde 202 y 409 si ya hay una en curso. `restaurando` en el dispositivo indica que está pendiente.
- **Atender una alerta:** `POST /alertas/{id}/atender` responde **409** si otro familiar ya la tomó; el `detail` dice quién ("Vero ya se está ocupando").

### Pendiente con Héctor

- Que las respuestas salgan en **camelCase** (hoy salen en snake_case, como en `schemas.py`).

## Cómo trabajar

- Una tarea por vez; mostrar el plan antes de crear muchos archivos.
- Componentes chicos y reutilizables; estilos siempre desde `tema.ts`.
- Después de cada cambio: `npx tsc --noEmit` sin errores.
- Commits chicos con mensaje en español que diga qué cambió.
- Después de cada commit, `git push`.
