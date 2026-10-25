FROM postgres:17-alpine

ENV POSTGRES_USER=app \
    POSTGRES_PASSWORD=app \
    POSTGRES_DB=app

HEALTHCHECK --interval=5s --timeout=5s --retries=10 \
  CMD pg_isready -U "${POSTGRES_USER:-app}" -d "${POSTGRES_DB:-app}"

EXPOSE 5432
