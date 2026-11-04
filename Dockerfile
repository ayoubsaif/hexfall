# Game server image (build from the repo root).
FROM node:24-slim AS build
WORKDIR /repo
RUN npm install -g pnpm@12.16.1
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @hexfall/server build \
 && pnpm --filter @hexfall/server deploy --prod /out

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /out/package.json ./
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
EXPOSE 8080
USER node
CMD ["node", "dist/main.mjs"]
