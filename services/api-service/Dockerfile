# Monorepo-aware build (context = repo root)
FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY services/shared/package.json services/shared/package.json
COPY services/api-service/package.json services/api-service/package.json
RUN npm install --omit=dev --workspaces --include-workspace-root || npm install --omit=dev

COPY services/shared services/shared
COPY services/api-service services/api-service
# OpenAPI spec served at /docs (Swagger UI)
COPY docs/api docs/api

EXPOSE 4000
CMD ["node", "services/api-service/src/index.js"]
