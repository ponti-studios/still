FROM node:24.18.0-alpine AS build
WORKDIR /app

ARG VITE_PUBLIC_API_URL
ENV VITE_PUBLIC_API_URL=${VITE_PUBLIC_API_URL}
# Fail the build rather than ship an app that can't find its API.
RUN test -n "$VITE_PUBLIC_API_URL"

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# nginx renders /etc/nginx/templates/*.template with the container's env (Railway sets PORT).
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
