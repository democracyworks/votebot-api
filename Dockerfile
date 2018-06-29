FROM node:alpine

# One of the node deps needs python, g++, & make for some reason *shrug emoji*
RUN apk add --no-cache python make g++

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
COPY package-lock.json /usr/src/app/
RUN npm install

COPY ./ /usr/src/app
RUN cp config.tpl.js config.js

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD []
