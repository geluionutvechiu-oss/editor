FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_URL=/api
ARG VITE_BASE_URL=http://localhost
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BASE_URL=$VITE_BASE_URL

COPY package.json ./
RUN npm install --frozen-lockfile
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
