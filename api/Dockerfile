FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm cache clean --force && npm ci

COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]
