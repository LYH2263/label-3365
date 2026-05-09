FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

COPY backend/pom.xml backend/pom.xml
RUN mvn -f backend/pom.xml -q -DskipTests dependency:go-offline

COPY backend backend
RUN mvn -f backend/pom.xml -q -DskipTests package

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

COPY --from=build /build/backend/target/chuanzi-restaurant-assistant.jar /app/app.jar
COPY web /app/web

ENV APP_PORT=8080
ENV WEB_ROOT=/app/web

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
