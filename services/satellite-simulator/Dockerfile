# Monorepo-aware build (context = repo root)
FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY services/shared/package.json services/shared/package.json
COPY services/satellite-simulator/package.json services/satellite-simulator/package.json
RUN npm install --omit=dev --workspaces --include-workspace-root || npm install --omit=dev

COPY services/shared services/shared
COPY services/satellite-simulator services/satellite-simulator

CMD ["node", "services/satellite-simulator/src/index.js"]
