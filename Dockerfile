# Frontend container: builds the static Vite bundle, then serves it with nginx.
# nginx also reverse-proxies /api/* to the backend, replicating what Vite's
# dev-only server.proxy does, so the app's relative fetch("/api/...") calls
# keep working unchanged.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
