# Monorepo-aware build (context = repo root)
FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY services/shared/package.json services/shared/package.json
COPY services/ingestion-service/package.json services/ingestion-service/package.json
RUN npm install --omit=dev --workspaces --include-workspace-root || npm install --omit=dev

COPY services/shared services/shared
COPY services/ingestion-service services/ingestion-service

EXPOSE 9101
CMD ["node", "services/ingestion-service/src/index.js"]
