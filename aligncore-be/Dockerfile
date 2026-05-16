FROM node:20-slim

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY dist/ ./dist/

ENV PORT=4000
EXPOSE 4000

CMD ["node", "dist/index.js"]
