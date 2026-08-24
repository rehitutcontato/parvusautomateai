export interface DockerConfig {
  projectName?: string;
  port?: number;
  nodeVersion?: string;
  includeDatabase?: boolean;
  includeMqtt?: boolean;
}

export function generateDockerFiles(config: DockerConfig = {}) {
  const name = (config.projectName || 'parvus-app').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const port = config.port || 3000;
  const nodeVersion = config.nodeVersion || '20-alpine';

  const dockerfile = `# Multi-stage Build Dockerfile for Parvus Automate Application
FROM node:${nodeVersion} AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production

# Dependency stage
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --production

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN if [ -f "tsconfig.json" ]; then npm run build 2>/dev/null || true; fi

# Production Runner stage
FROM base AS runner
WORKDIR /app
ENV PORT=${port}
ENV HOST=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

COPY --from=deps --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app ./

USER appuser

EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:${port}/api/health || exit 1

CMD ["npm", "start"]
`;

  const dockerignore = `node_modules
dist
build
.git
.gitignore
.env
.env.local
*.log
npm-debug.log*
.DS_Store
coverage
`;

  const dockerCompose = `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${name}
    restart: unless-stopped
    ports:
      - "${port}:${port}"
    environment:
      - NODE_ENV=production
      - PORT=${port}
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:${port}/api/health || exit 0"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - app-network

${config.includeMqtt ? `  mqtt:
    image: eclipse-mosquitto:latest
    container_name: ${name}-mqtt
    restart: unless-stopped
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - mosquitto_data:/mosquitto/data
      - mosquitto_log:/mosquitto/log
    networks:
      - app-network
` : ''}
networks:
  app-network:
    driver: bridge

${config.includeMqtt ? `volumes:
  mosquitto_data:
  mosquitto_log:
` : ''}`;

  const devcontainerJson = `{
  "name": "${name} (Dev Container)",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:1-20-bullseye",
  "forwardPorts": [${port}],
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "bradlc.vscode-tailwindcss"
      ]
    }
  },
  "postCreateCommand": "npm install",
  "remoteUser": "node"
}
`;

  const readmeDeploy = `# Instruções de Deploy com Docker

Este projeto foi gerado automaticamente pelo **Parvus Automate AI** com suporte completo a containerização.

## 🚀 Como rodar com Docker Compose

\`\`\`bash
# 1. Copie o arquivo de variáveis de ambiente
cp .env.example .env

# 2. Construa e inicie os containers em segundo plano
docker compose up -d --build

# 3. Acesse a aplicação no seu navegador
http://localhost:${port}
\`\`\`

## 🛠️ Comandos Úteis

\`\`\`bash
# Ver logs em tempo real
docker compose logs -f app

# Parar os containers
docker compose down

# Reiniciar aplicação
docker compose restart app
\`\`\`
`;

  return {
    dockerfile,
    dockerignore,
    dockerCompose,
    devcontainerJson,
    readmeDeploy
  };
}
