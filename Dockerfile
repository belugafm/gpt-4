FROM node:19

RUN apt install libnss3-dev
RUN npm install -g npm@latest

COPY . .
RUN npm install -g ts-node
RUN npm install

ENV NODE_ENV=production