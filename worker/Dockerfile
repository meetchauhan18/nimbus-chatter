FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm cache clean --force && npm ci

COPY . .

CMD ["node", "src/index.js"]
