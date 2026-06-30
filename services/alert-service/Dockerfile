# Monorepo-aware build (context = repo root)
FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY services/shared/package.json services/shared/package.json
COPY services/alert-service/package.json services/alert-service/package.json
RUN npm install --omit=dev --workspaces --include-workspace-root || npm install --omit=dev

COPY services/shared services/shared
COPY services/alert-service services/alert-service

EXPOSE 4100
CMD ["node", "services/alert-service/src/index.js"]
