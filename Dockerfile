# Build stage - uses pre-built base with node_modules
ARG BUILDER_IMAGE=ghcr.io/cubeos-app/dashboard-builder:latest
FROM ${BUILDER_IMAGE} AS builder

WORKDIR /app

# Copy source code (node_modules already present from base)
COPY . .

# Build for production (fast - no npm install needed)
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
