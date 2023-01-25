FROM node:19

RUN npm install -g npm@latest

COPY . .
RUN npm install -g ts-node
RUN npm install
RUN chmod +x ./start.sh

ENV NODE_ENV=production
CMD ["./start.sh"]