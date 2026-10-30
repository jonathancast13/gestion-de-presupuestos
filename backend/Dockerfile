# Imagen de DESARROLLO: arranca Flask con recarga automática.
# Para producción usa un servidor WSGI (gunicorn) en lugar de `flask run`.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_APP=app.py \
    FLASK_DEBUG=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

# --host 0.0.0.0: accesible desde fuera del contenedor
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]
