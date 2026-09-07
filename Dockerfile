FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# Include the git SHA file produced by the builder's prebuild hook.
COPY --from=builder /app/git_sha ./git_sha
RUN mkdir -p /app/uploads/tours && chown -R node:node /app/uploads
VOLUME /app/uploads
EXPOSE 3000
CMD ["npm", "start"]
