# Build stage - uses pre-built base with node_modules
ARG BUILDER_IMAGE=ghcr.io/cubeos-app/dashboard-builder:latest
FROM ${BUILDER_IMAGE} AS builder
WORKDIR /app

# Copy source code (node_modules already present from base)
COPY . .

# Install any new dependencies not in the base image (fast - only installs delta)
RUN npm install --no-audit --no-fund

# Build for production
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx template (envsubst substitutes API_URL/DOCS_URL at startup)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Default upstream URLs (Pi gateway IP — overridden by env vars on x86/container installs)
ENV API_URL=http://10.42.24.1:6010
ENV DOCS_URL=http://10.42.24.1:6032
# Only substitute our vars — protect nginx variables ($host, $uri, $http_upgrade etc.)
ENV NGINX_ENVSUBST_FILTER=^(API_URL|DOCS_URL)$

EXPOSE 80
# nginx:alpine image has built-in envsubst support via /docker-entrypoint.d/20-envsubst-on-templates.sh
# It reads /etc/nginx/templates/*.template, substitutes env vars, writes to /etc/nginx/conf.d/
CMD ["nginx", "-g", "daemon off;"]
