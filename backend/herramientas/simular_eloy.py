#!/usr/bin/env python3
"""Simulador de Eloy (la Raspberry) para probar el backend sin el aparato.

Sigue el "Contrato con la Raspberry" del README y sirve de base para el módulo de sync de la Pi:
el archivo de estado hace de SQLite (listas, ids locales, lo que falta confirmar). Solo usa la
biblioteca estándar.

    python herramientas/simular_eloy.py alta      registra un Eloy y carga los datos de ejemplo
    python herramientas/simular_eloy.py codigo    código para vincularlo desde la app
    python herramientas/simular_eloy.py sync      una vuelta de sincronización
    python herramientas/simular_eloy.py alerta "Me caí en la cocina"

Un mensaje de la app tarda 3 vueltas en quedar "leído": llega, se confirma (entregado) y se informa
que Eloy ya lo leyó. Por eso conviene correr `sync` dos o tres veces seguidas.

Variables de entorno: ELOY_API (por defecto http://localhost:8000) y PROVISIONING_KEY (por defecto
la de docker-compose.yml). El estado queda en herramientas/.eloy_simulado.json, que no va a git;
con --estado se puede simular más de un Eloy.
"""
from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

API = os.environ.get("ELOY_API", "http://localhost:8000").rstrip("/")
PROVISIONING_KEY = os.environ.get("PROVISIONING_KEY", "otra-clave-solo-para-desarrollo-9876543210-abcdef")
ESTADO_POR_DEFECTO = Path(__file__).with_name(".eloy_simulado.json")
DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


# ---------------------------------------------------------------- HTTP

def pedir(metodo: str, ruta: str, cuerpo: dict | None = None, token: str | None = None,
          encabezados: dict | None = None) -> tuple[int, object]:
    """Devuelve (código HTTP, JSON). Si el servidor responde error, el JSON es el `detail`."""
    cabeceras = {"Content-Type": "application/json", **(encabezados or {})}
    if token:
        cabeceras["Authorization"] = f"Bearer {token}"
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    pedido = urllib.request.Request(API + ruta, data=datos, method=metodo, headers=cabeceras)
    try:
        with urllib.request.urlopen(pedido, timeout=15) as r:
            texto = r.read().decode()
            return r.status, json.loads(texto) if texto else None
    except urllib.error.HTTPError as e:
        texto = e.read().decode()
        try:
            return e.code, json.loads(texto).get("detail", texto)
        except (ValueError, AttributeError):
            return e.code, texto
    except urllib.error.URLError as e:
        sys.exit(f"No pude conectarme a {API} ({e.reason}). ¿Está levantada la API? (docker compose up)")


def esperar(estado: int, datos: object, esperado: int, que: str) -> None:
    if estado != esperado:
        sys.exit(f"{que}: el servidor respondió {estado}: {datos}")


def token(base: dict) -> str:
    estado, datos = pedir("POST", "/dispositivo/token", {"uid_serie": base["uid_serie"], "secret": base["secret"]})
    esperar(estado, datos, 200, "Token")
    return datos["access_token"]


def mostrar(titulo: str, datos: object) -> None:
    print(f"\n{titulo}")
    print(json.dumps(datos, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------- estado (la "SQLite" de la Pi)

def leer_estado(ruta: Path) -> dict:
    if not ruta.exists():
        sys.exit(f"No hay un Eloy simulado en {ruta}. Corré primero: simular_eloy.py alta")
    return json.loads(ruta.read_text())


def guardar_estado(ruta: Path, base: dict) -> None:
    # Tiene la clave del aparato: solo la puede leer el usuario (como el archivo 600 de la Pi).
    descriptor = os.open(ruta, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as archivo:
        json.dump(base, archivo, indent=2, ensure_ascii=False)


def ahora_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def ahora_local(menos_minutos: int = 0) -> str:
    return (datetime.now() - timedelta(minutes=menos_minutos)).strftime("%Y-%m-%d %H:%M:%S")


def recordatorio(id_local: int, titulo: str, horario: str, *, diario: bool = False, dias: str | None = None,
                 descripcion: str | None = None) -> dict:
    return {"id": id_local, "titulo": titulo, "descripcion": descripcion, "horario": horario,
            "se_repite_diario": diario, "dias_semana": "todos" if diario else dias, "fecha": None,
            "completado": False, "ultima_ejecucion": None}


def datos_de_ejemplo() -> dict:
    """Marta, 3 recordatorios, una charla y un mensaje para la familia. Los familiares empiezan
    vacíos: el administrador que se crea al vincular llega en el primer sync."""
    return {
        "estado": {"volumen": 70, "wifi_ssid": "Casa de Marta", "version_software": "simulador-1.0"},
        "usuario": {"nombre": "Marta", "edad": 78, "tiene_pulsera": False},
        "familiares": [],
        "recordatorios": [
            recordatorio(1, "Pastilla de la presión", "09:00", diario=True, descripcion="la blanca, con agua"),
            recordatorio(2, "Almorzar", "13:00", diario=True),
            recordatorio(3, "Gimnasia", "17:00", dias="lunes,jueves"),
        ],
        "memoria": [],
        # ocurrio_en va en UTC; `creado` de los mensajes, en hora local (como en la Pi).
        "eventos": [{"id": 1, "tipo": "conversacion", "descripcion": "charló 4 minuto(s)", "ocurrio_en": ahora_utc()}],
        "mensajes": [{"id": 1, "tipo": "mensaje", "direccion": "a_familia", "de": "Marta", "para": None,
                      "texto": "Hoy fui a la plaza con Rosa y tomamos un café.", "audio_key": None,
                      "audio_duracion_seg": None, "creado": ahora_local(menos_minutos=5), "entregado": False}],
        # Cursores de lo incremental: el último id que el servidor ya recibió.
        "ultimo_evento_enviado": 0,
        "ultimo_mensaje_enviado": 0,
        # Lo que se manda en la vuelta siguiente.
        "por_confirmar": [],
        "leidos_por_informar": [],
        "comandos_por_informar": [],
        # id del comando -> resultado, para no ejecutarlo dos veces si la confirmación se perdió.
        "comandos_ejecutados": {},
    }


def siguiente_id(filas: list[dict]) -> int:
    return max((f["id"] for f in filas), default=0) + 1


# ---------------------------------------------------------------- comandos

def cmd_alta(args) -> None:
    ruta = Path(args.estado)
    if ruta.exists() and not args.forzar:
        sys.exit(f"Ya hay un Eloy simulado en {ruta}. Para empezar de cero: simular_eloy.py alta --forzar")
    # Como la Pi en fábrica: genera su identificador y su clave, y se registra una sola vez.
    base = {"uid_serie": f"eloy-sim-{secrets.token_hex(4)}", "secret": secrets.token_urlsafe(32), **datos_de_ejemplo()}
    estado, datos = pedir("POST", "/dispositivo/registro", {"uid_serie": base["uid_serie"], "secret": base["secret"]},
                          encabezados={"X-Provisioning-Key": PROVISIONING_KEY})
    esperar(estado, datos, 201, "Alta")
    guardar_estado(ruta, base)
    print(f"Eloy registrado: {base['uid_serie']}. Clave guardada en {ruta}.")
    print("Siguiente paso: simular_eloy.py codigo")


def cmd_codigo(args) -> None:
    base = leer_estado(Path(args.estado))
    estado, datos = pedir("POST", "/dispositivo/codigo", token=token(base))
    if estado == 409:
        sys.exit("Este Eloy ya está vinculado. Para volver a vincularlo hay que restaurarlo de fábrica desde la app.")
    esperar(estado, datos, 201, "Código")
    vence = datetime.fromisoformat(datos["expira_en"].replace("Z", "+00:00")).astimezone()
    print(f"\n    Código para vincular: {datos['codigo']}\n")
    print(f"Vence a las {vence:%H:%M}. En la app: Vincular a Eloy → Escribir el código a mano.")


def _hacer_sonar(base: dict) -> None:
    """Como Eloy durante el día: los recordatorios de hoy cuya hora ya pasó quedan como que sonaron."""
    ahora = datetime.now()
    hoy, hora = ahora.date().isoformat(), ahora.strftime("%H:%M")
    for r in base["recordatorios"]:
        dias = r["dias_semana"] or ""
        toca_hoy = r["se_repite_diario"] or DIAS[ahora.weekday()] in dias.split(",") or r["fecha"] == hoy
        if toca_hoy and r["horario"][:5] <= hora:
            r["ultima_ejecucion"] = hoy


def _armar_sync(base: dict) -> dict:
    # Los de_familia que vinieron del servidor no se reenvían: el servidor ya los tiene.
    nuevos = [m for m in base["mensajes"] if m["id"] > base["ultimo_mensaje_enviado"] and not m.get("id_servidor")]
    return {
        "estado": base["estado"],
        "usuario": base["usuario"],
        # Listas completas: lo que falta se considera borrado en Eloy.
        "familiares": base["familiares"],
        "recordatorios": base["recordatorios"],
        "memoria": base["memoria"],
        # Incrementales: solo lo que el servidor todavía no recibió.
        "eventos": [e for e in base["eventos"] if e["id"] > base["ultimo_evento_enviado"]],
        "mensajes": [{k: v for k, v in m.items() if k != "id_servidor"} for m in nuevos],
        "resumenes": [],
        # Respuestas a la vuelta anterior.
        "confirmaciones": base["por_confirmar"],
        "mensajes_leidos": base["leidos_por_informar"],
        "comandos": base["comandos_por_informar"],
    }


def _aplicar_lista(filas: list[dict], item: dict, campos: tuple[str, ...]) -> int | None:
    """Inserta, actualiza o borra una fila según lo que mandó el servidor. Devuelve el id local
    (None si era un borrado), que es lo que hay que confirmar."""
    if item["eliminado"]:
        filas[:] = [f for f in filas if f["id"] != item["id_local"]]
        return None
    fila = next((f for f in filas if f["id"] == item["id_local"]), None)
    if fila is None:
        fila = {"id": siguiente_id(filas)}
        filas.append(fila)
    fila.update({c: item[c] for c in campos})
    return fila["id"]


def _ejecutar_comando(base: dict, comando: dict) -> dict:
    tipo, parametros = comando["tipo"], comando.get("parametros") or {}
    if tipo == "ajustar_volumen":
        base["estado"]["volumen"] = parametros["volumen"]
        print(f"  · Volumen: {parametros['volumen']} %")
    elif tipo == "borrar_memoria":
        base["memoria"] = [m for m in base["memoria"] if m["clave"] != parametros.get("clave")]
        print(f"  · Borré de la memoria: {parametros.get('clave')}")
    elif tipo == "restaurar_fabrica":
        # Se borra todo menos la identidad del aparato (uid y clave sobreviven a "restaurar").
        limpio = datos_de_ejemplo()
        for clave in ("familiares", "recordatorios", "memoria", "eventos", "mensajes"):
            base[clave] = []
        base["usuario"] = None
        base["ultimo_evento_enviado"] = base["ultimo_mensaje_enviado"] = 0
        base["estado"] = limpio["estado"]
        print("  · Restaurado de fábrica: queda sin datos y sin vincular")
    else:
        return {"id": comando["id"], "estado": "fallido", "error": f"comando desconocido: {tipo}"}
    return {"id": comando["id"], "estado": "ejecutado"}


def _procesar_respuesta(base: dict, resp: dict) -> None:
    por_confirmar, leidos, comandos = [], [], []

    for m in resp.get("mensajes", []):
        # Si la confirmación anterior se perdió, el mismo mensaje vuelve: no se duplica.
        fila = next((x for x in base["mensajes"] if x.get("id_servidor") == m["id"]), None)
        if fila is None:
            fila = {"id": siguiente_id(base["mensajes"]), "id_servidor": m["id"], "tipo": "mensaje",
                    "direccion": "de_familia", "de": m["de"], "para": None, "texto": m["texto"],
                    "audio_key": None, "audio_duracion_seg": None, "creado": ahora_local(), "entregado": False}
            base["mensajes"].append(fila)
            print(f"  · Mensaje de {m['de']}: «{m['texto']}» → Eloy se lo lee a Marta")
            fila["entregado"] = True  # en la Pi esto pasa cuando lo dice en voz alta
        por_confirmar.append({"tabla": "mensajes", "id": m["id"], "id_local": fila["id"]})

    for id_local in resp.get("mensajes_esperando_lectura", []):
        if any(x["id"] == id_local and x["entregado"] for x in base["mensajes"]):
            leidos.append(id_local)

    listas = (("recordatorios", ("titulo", "descripcion", "horario", "se_repite_diario", "dias_semana", "fecha",
                                 "completado")),
              ("familiares", ("nombre", "relacion", "numero_whatsapp", "numero_prioridad")))
    for tabla, campos in listas:
        for item in resp.get(tabla, []):
            id_local = _aplicar_lista(base[tabla], item, campos)
            accion = "borré" if id_local is None else "guardé"
            print(f"  · {tabla.capitalize()}: {accion} «{item.get('titulo') or item.get('nombre')}»")
            por_confirmar.append({"tabla": tabla, "id": item["id"], "id_local": id_local, "version": item["version"]})

    for comando in resp.get("comandos", []):
        clave = str(comando["id"])
        if clave not in base["comandos_ejecutados"]:
            base["comandos_ejecutados"][clave] = _ejecutar_comando(base, comando)
        comandos.append(base["comandos_ejecutados"][clave])

    base["por_confirmar"], base["leidos_por_informar"], base["comandos_por_informar"] = por_confirmar, leidos, comandos


def cmd_sync(args) -> None:
    ruta = Path(args.estado)
    base = leer_estado(ruta)
    _hacer_sonar(base)
    cuerpo = _armar_sync(base)
    if args.ver_envio:
        mostrar("→ Mando:", cuerpo)
    estado, resp = pedir("POST", "/dispositivo/sync", cuerpo, token=token(base))
    esperar(estado, resp, 200, "Sync")

    print(f"→ Mandé {len(cuerpo['eventos'])} evento(s), {len(cuerpo['mensajes'])} mensaje(s), "
          f"{len(cuerpo['confirmaciones'])} confirmación(es), {len(cuerpo['mensajes_leidos'])} leído(s) "
          f"y {len(cuerpo['comandos'])} resultado(s) de comandos.")
    mostrar("← El servidor responde:", resp)

    # Ya entregado lo de esta vuelta. Sin vincular, el servidor no guarda nada: se reenvía después.
    base["por_confirmar"], base["leidos_por_informar"], base["comandos_por_informar"] = [], [], []
    if resp.get("vinculado"):
        base["ultimo_evento_enviado"] = max([e["id"] for e in cuerpo["eventos"]] + [base["ultimo_evento_enviado"]])
        base["ultimo_mensaje_enviado"] = max([m["id"] for m in cuerpo["mensajes"]] + [base["ultimo_mensaje_enviado"]])
    else:
        print("\nEloy no está vinculado: el servidor no guardó nada. Corré `simular_eloy.py codigo`.")

    print("\nLo que hace Eloy con eso:")
    _procesar_respuesta(base, resp)
    pendiente = len(base["por_confirmar"]) + len(base["leidos_por_informar"]) + len(base["comandos_por_informar"])
    print(f"  · {pendiente} cosa(s) para confirmar en el próximo sync." if pendiente else "  · Nada pendiente.")
    guardar_estado(ruta, base)


def cmd_alerta(args) -> None:
    ruta = Path(args.estado)
    base = leer_estado(ruta)
    # Como la Pi: la emergencia queda en su tabla de mensajes y se avisa ya, sin esperar el sync.
    # Si este pedido falla, el sync la reenvía y el id_local evita que llegue dos veces.
    fila = {"id": siguiente_id(base["mensajes"]), "tipo": "emergencia", "direccion": "a_familia", "de": "Marta",
            "para": None, "texto": args.motivo, "audio_key": None, "audio_duracion_seg": None,
            "creado": ahora_local(), "entregado": False}
    base["mensajes"].append(fila)
    guardar_estado(ruta, base)
    estado, datos = pedir("POST", "/dispositivo/alertas", {"id_local": fila["id"], "origen": "voz", "motivo": args.motivo},
                          token=token(base))
    if estado == 409:
        sys.exit("Eloy no está vinculado: no hay a quién avisar.")
    esperar(estado, datos, 201, "Alerta")
    mostrar("← El servidor responde:", datos)
    print("La familia recibe el aviso. Mirá la app: Inicio muestra el cartel rojo.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Simula un Eloy (la Raspberry) contra la API.")
    parser.add_argument("--estado", default=str(ESTADO_POR_DEFECTO), help="archivo de estado (uno por Eloy simulado)")
    sub = parser.add_subparsers(dest="comando", required=True)
    alta = sub.add_parser("alta", help="registra un Eloy nuevo con la clave de provisión")
    alta.add_argument("--forzar", action="store_true", help="pisa el Eloy simulado que ya había")
    sub.add_parser("codigo", help="imprime el código de vinculación")
    sync = sub.add_parser("sync", help="una vuelta de sincronización")
    sync.add_argument("--ver-envio", action="store_true", help="muestra también lo que se manda")
    alerta = sub.add_parser("alerta", help="Marta pide ayuda")
    alerta.add_argument("motivo", nargs="?", default="Me caí en la cocina y no me puedo levantar")
    args = parser.parse_args()
    {"alta": cmd_alta, "codigo": cmd_codigo, "sync": cmd_sync, "alerta": cmd_alerta}[args.comando](args)


if __name__ == "__main__":
    main()
