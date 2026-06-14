FROM node:24-alpine As development

WORKDIR /usr/src/app

RUN corepack enable && corepack prepare pnpm@10.34.3 --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build:app

FROM nginx:alpine As production

RUN rm /etc/nginx/conf.d/default.conf
COPY ./nginx.conf /etc/nginx/conf.d

COPY --from=development /usr/src/app/dist/app/browser /usr/share/nginx/html

EXPOSE 80