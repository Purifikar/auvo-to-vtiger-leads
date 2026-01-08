# Base image with Playwright and browsers pre-installed
FROM mcr.microsoft.com/playwright:v1.55.1-jammy

# Set working directory
WORKDIR /app

# Copy package files AND prisma schema (needed for postinstall)
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (Playwright é necessário em runtime!)
RUN npm ci

# Copy the rest of source code
COPY . .

# Build TypeScript
RUN npm run build

# NÃO remover devDependencies pois @playwright/test é necessário!
# O prune estava causando o erro "Cannot find module '@playwright/test'"

# Expose ports
# 3000 = API server
EXPOSE 3000

# Default command (can be overridden in docker-compose)
ARG MODE=api
ENV MODE=${MODE}

# Health check (only works in API mode)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD if [ "$MODE" = "api" ]; then curl -f http://localhost:3000/health || exit 1; else exit 0; fi

# Start command based on MODE
CMD ["sh", "-c", "if [ \"$MODE\" = \"scheduler\" ]; then node dist/scheduler/index.js; else node dist/api/server.js; fi"]
