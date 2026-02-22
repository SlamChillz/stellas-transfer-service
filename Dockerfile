# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production stage
FROM node:22-alpine AS runtime

WORKDIR /app

# App version at build time (optional: pass via --build-arg)
ARG APP_VERSION=1.0.0
ENV APP_VERSION=${APP_VERSION} \
    NODE_ENV=production

RUN apk add --no-cache curl

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY database ./database
COPY .sequelizerc ./

USER node
EXPOSE 3000

# Migrate then start (single process; for multi-replica use a job for migrations)
CMD ["sh", "-c", "npx sequelize-cli db:migrate && node dist/index.js"]
