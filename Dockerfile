FROM node:10
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 8000

CMD [ "node", "server.js" ]
