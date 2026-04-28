FROM node:18-alpine

LABEL project="Werecloud ioT NanoMQ Dashboard"

ENV NODE_OPTIONS=--max-old-space-size=8192

WORKDIR /www

RUN corepack enable && pnpm config set registry https://registry.npmmirror.com

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

FROM svenstaro/miniserve:alpine

WORKDIR /app

COPY --from=0 /www/dist .

EXPOSE 8080

CMD ["--spa", "--index", "index.html"]
