FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY dist/ ./dist/

ENV PORT=4000
EXPOSE 4000

CMD ["node", "dist/index.js"]
