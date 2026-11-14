FROM node:26-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-slim

WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# The data folder is mounted over. Create it owned by the non-root user so a named volume inherits that.
RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production \
    PORT=6972 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data

USER node
EXPOSE 6972
CMD ["node", "server.js"]
