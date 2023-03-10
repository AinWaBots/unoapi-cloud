FROM node:18-alpine AS builder

ENV NODE_ENV=development

RUN apk --update --no-cache add git

WORKDIR /app

ADD ./src ./src
ADD ./package.json ./package.json
ADD ./tsconfig.json ./tsconfig.json
ADD ./yarn.lock ./yarn.lock

RUN yarn
RUN yarn build

FROM node:18-alpine

LABEL \
  maintainer="Clairton Rodrigo Heinzen <clairton.rodrigo@gmail.com>" \
  org.opencontainers.image.title="Baileys Cloud API" \
  org.opencontainers.image.description="Baileys Cloud API" \
  org.opencontainers.image.authors="Clairton Rodrigo Heinzen <clairton.rodrigo@gmail.com>" \
  org.opencontainers.image.url="https://github.com/clairton/baileys-cloud-api" \
  org.opencontainers.image.vendor="https://clairton.eti.br" \
  org.opencontainers.image.licenses="GPLv3"

ENV NODE_ENV=production

RUN addgroup -S bca && adduser -S bca -G bca
WORKDIR /home/bca/app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/yarn.lock ./yarn.lock

RUN apk --update --no-cache add git
RUN yarn
RUN apk del git

ENTRYPOINT yarn start
