FROM node:20-bookworm-slim AS builder
ARG CAPOY_BUILD_SHA=unknown
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
ENV CAPOY_BUILD_SHA=${CAPOY_BUILD_SHA}
RUN npm run build

FROM node:20-bookworm-slim AS runner
ARG CAPOY_BUILD_SHA=unknown
WORKDIR /app
ENV NODE_ENV=production
ENV CAPOY_BUILD_SHA=${CAPOY_BUILD_SHA}
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
RUN mkdir -p /app/uploads/tours && chown -R node:node /app/uploads
VOLUME /app/uploads
EXPOSE 3000
CMD ["npm", "start"]
