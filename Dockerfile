# Base image with Playwright and browsers pre-installed
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

# Set working directory
WORKDIR /app

# Copy package files AND prisma schema (needed for postinstall)
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for build)
# This will also run postinstall (prisma generate)
RUN npm ci

# Copy the rest of source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove devDependencies after build to reduce image size
RUN npm prune --production

# Expose ports
# 3000 = API server
EXPOSE 3000

# Default command (can be overridden in docker-compose)
# Use "api" or "scheduler" as argument
ARG MODE=api
ENV MODE=${MODE}

# Health check (only works in API mode)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD if [ "$MODE" = "api" ]; then curl -f http://localhost:3000/health || exit 1; else exit 0; fi

# Start command based on MODE
CMD ["sh", "-c", "if [ \"$MODE\" = \"scheduler\" ]; then node dist/scheduler/index.js; else node dist/api/server.js; fi"]
