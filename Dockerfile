# syntax=docker/dockerfile:1.7

# ---------- Builder ----------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# ---------- Runtime ----------
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
# `--ignore-scripts` pula o `prepare: husky` (husky é devDep, não está instalada em prod).
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/i18n ./i18n

EXPOSE 3000

# Roda migrations Prisma antes de subir o servidor.
# Usar `migrate deploy` (não `dev`) — só aplica migrations existentes, não gera novas.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
