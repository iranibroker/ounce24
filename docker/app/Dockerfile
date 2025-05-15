FROM node:20.18.0-alpine As development

WORKDIR /usr/src/app

COPY package.json .

COPY yarn.lock .

RUN yarn

COPY . .

RUN yarn build:app

FROM nginx:alpine As production

RUN rm /etc/nginx/conf.d/default.conf
COPY ./nginx.conf /etc/nginx/conf.d

COPY --from=development /usr/src/app/dist/app/browser /usr/share/nginx/html

EXPOSE 80