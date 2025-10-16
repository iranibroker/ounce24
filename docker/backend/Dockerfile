FROM node:20.18.0-alpine As development

WORKDIR /usr/src/app

COPY package.json .

RUN yarn

COPY . .

RUN yarn build:backend

FROM node:20.18.0-alpine As production

WORKDIR /backend

COPY --from=development /usr/src/app/node_modules ./node_modules

COPY --from=development /usr/src/app/dist/backend src

CMD ["node", "src/main.js"]