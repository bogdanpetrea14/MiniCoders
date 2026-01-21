FROM node:18-alpine

WORKDIR /app

# copy package manifest first for faster rebuilds
COPY package.json ./

RUN npm install --production

# copy rest of exporter files
COPY . .

EXPOSE 9100

CMD ["node", "exporter.js"]
