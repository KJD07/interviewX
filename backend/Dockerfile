FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x docker-entrypoint.sh

EXPOSE 8000

# daphne (ASGI), not gunicorn (WSGI) — see docker-compose.yml's backend
# command for why (apps.enterprise's live-camera WebSocket signaling needs
# to share this same port/process). Migrations run in docker-entrypoint.sh.
CMD ["./docker-entrypoint.sh"]
