FROM node:22-slim AS build
WORKDIR /app
COPY webapp/package.json webapp/package-lock.json ./
RUN npm install
COPY webapp/ ./
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/state/types.ts ./src/state/types.ts
COPY --from=build /app/package.json ./
EXPOSE 3456
ENV NODE_ENV=production
CMD ["npx", "tsx", "server/index.ts"]
