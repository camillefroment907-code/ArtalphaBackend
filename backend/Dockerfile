FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "i=0; until alembic upgrade head; do i=$((i+1)); if [ $i -ge 5 ]; then echo 'Alembic failed after 5 retries, aborting'; exit 1; fi; echo \"Alembic retry $i/5 in 5s...\"; sleep 5; done && uvicorn app.main:app --host 0.0.0.0 --port 8080"]
