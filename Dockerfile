# Multi-stage Dockerfile for SnackForest (Render-friendly)
# Build stage
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
COPY backend/lib/ ./lib/
COPY backend/src/ ./src/
RUN javac -cp "lib/*:." -d ./bin src/*.java src/dao/*.java src/model/*.java

# Runtime stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/bin ./bin
COPY --from=build /app/lib ./lib
COPY frontend/ ./frontend
RUN mkdir -p /var/snackforest/data/uploads/images /var/snackforest/data/uploads/avatar || true

# Expose a mount point for persistent data. In production, mount a host path or a named volume
# to /var/snackforest/data so uploaded files survive container recreation.
VOLUME ["/var/snackforest/data"]

# Environment variables (can be overridden on Render)
ENV DB_HOST=localhost \
    DB_PORT=3306 \
    DB_NAME=test0310 \
    DB_USER=root \
    DB_PASSWORD=lkjh890612

EXPOSE 8000

# Healthcheck used by Render to verify app is up
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:8000/ping || exit 1

# Start server
CMD ["java", "-cp", "bin:lib/*", "Server"]