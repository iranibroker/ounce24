FROM node:24-alpine As development

WORKDIR /usr/src/app

RUN corepack enable && corepack prepare pnpm@10.34.3 --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build:backend

FROM node:24-alpine As production

WORKDIR /backend

COPY --from=development /usr/src/app/node_modules ./node_modules

COPY --from=development /usr/src/app/dist/backend src

CMD ["node", "src/main.js"]