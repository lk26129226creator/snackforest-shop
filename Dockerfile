# 多階段構建 - 最簡潔乾淨的 Dockerfile
FROM openjdk:17-jdk-alpine AS builder
WORKDIR /app
COPY backend/lib/ ./lib/
COPY backend/src/ ./src/
RUN javac -cp "lib/*:." -d . src/*.java src/dao/*.java src/model/*.java

FROM openjdk:17-jre-alpine
RUN apk add --no-cache wget
WORKDIR /app
COPY --from=builder /app/*.class /app/dao/ /app/model/ ./
COPY --from=builder /app/lib/ ./lib/
COPY frontend/ ./frontend/

ENV DB_HOST=localhost DB_PORT=3306 DB_NAME=test0310 DB_USER=root DB_PASSWORD=lkjh890612

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8000/ping || exit 1

CMD ["java", "-cp", ".:lib/*", "Server"]