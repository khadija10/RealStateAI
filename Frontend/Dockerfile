# --- Étape 1 : build de l'application React/Vite ---
FROM node:20-alpine AS build

WORKDIR /app

# On copie d'abord les fichiers de dépendances pour profiter du cache Docker
COPY package.json package-lock.json ./
RUN npm ci

# On copie le reste du code et on build
COPY . .

# URL du backend utilisée au moment du build (les apps Vite figent leurs
# variables d'environnement à la compilation). Peut être surchargée depuis
# docker-compose.yml avec "args: VITE_API_URL: ...".
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# --- Étape 2 : servir les fichiers statiques avec nginx ---
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
