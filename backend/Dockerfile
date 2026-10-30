FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY scripts ./scripts
COPY sql ./sql
# Usuario y grupo fijos y en número: Northflank (y Kubernetes con fsGroup) le da el volumen de
# /app/media al grupo del USER de la imagen. Con un nombre o un UID que elige useradd, puede quedar sin
# permiso de escritura.
RUN groupadd -g 10001 eloy && useradd -u 10001 -g eloy -M -s /usr/sbin/nologin eloy \
    && mkdir -p /app/media && chown eloy:eloy /app/media
USER 10001:10001
EXPOSE 8000
# Uvicorn solo confía en X-Forwarded-For si viene de las IP de FORWARDED_ALLOW_IPS (por defecto
# 127.0.0.1). NO pongas '*': cualquiera podría falsear su IP y saltarse el límite de intentos.
# Detrás de un balanceador, definila con la IP o el rango de ese balanceador (ver README). En Northflank,
# el proxy agrega la IP real al final de X-Forwarded-For y uvicorn toma la última que no sea de ese rango.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/salud' % os.environ.get('PORT','8000'), timeout=4)"
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
