# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- serve stage ---
FROM nginx:1.27-alpine
# nginx:alpine runs envsubst on *.template into /etc/nginx/conf.d at startup.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV BACKEND_URL=http://localhost:8000
EXPOSE 80
