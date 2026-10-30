# Imagen de DESARROLLO: arranca `next dev` con hot reload.
FROM node:24-alpine

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

# next dev escucha en 0.0.0.0 por defecto (Next 16)
CMD ["npm", "run", "dev"]
