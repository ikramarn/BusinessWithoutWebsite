FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source
COPY . .

EXPOSE 5000

# Run as non-root
USER node

CMD ["node", "server.js"]
