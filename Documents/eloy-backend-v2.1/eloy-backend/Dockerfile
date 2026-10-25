FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY scripts ./scripts
COPY sql ./sql
RUN useradd -r eloy && mkdir -p /app/media && chown eloy /app/media
USER eloy
EXPOSE 8000
# Uvicorn solo confía en X-Forwarded-For si viene de las IP de FORWARDED_ALLOW_IPS (por defecto
# 127.0.0.1). NO pongas '*': cualquiera podría falsear su IP y saltarse el límite de intentos.
# Detrás de un balanceador, definila con la IP o el rango de ese balanceador (ver README).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/salud' % os.environ.get('PORT','8000'), timeout=4)"
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
