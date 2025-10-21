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
RUN apk add --no-cache curl
COPY --from=build /app/bin ./bin
COPY --from=build /app/lib ./lib
COPY frontend/ ./frontend

# Environment variables (can be overridden on Render)
ENV DB_HOST=localhost \
    DB_PORT=3306 \
    DB_NAME=test0310 \
    DB_USER=root \
    DB_PASSWORD=lkjh890612

EXPOSE 8000

# Healthcheck used by Render to verify app is up
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/ping || exit 1

# Start server
CMD ["java", "-cp", "bin:lib/*", "Server"]