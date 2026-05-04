# =================================================
# Multi-stage Dockerfile for Open API Facturación SRI (NestJS)
# =================================================

# -----------------------------
# Stage 1: Build
# -----------------------------
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

# -----------------------------
# Stage 2: Production
# -----------------------------
FROM node:22-alpine AS production

# Set environment to production
ENV NODE_ENV=production
ENV TZ=America/Guayaquil

# Install tzdata for timezone support
RUN apk add --no-cache tzdata

# Set working directory
WORKDIR /app

# Copy package files
COPY --from=builder /app/package*.json ./

# Copy production dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist

# Create directories for volumes
RUN mkdir -p /data/templates /data/pdfs /data/certs /data/xmls \
    /data/pdfs/con_firma /data/pdfs/others /data/pdfs/documents /data/pdfs/images

# Expose the application port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/status || exit 1

# Start the application
CMD ["node", "dist/main"]
