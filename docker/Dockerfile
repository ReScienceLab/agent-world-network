FROM node:22-bookworm-slim

WORKDIR /app

# Install deps first (layer cache)
COPY package.json ./
RUN npm install

# Build TypeScript
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# Copy test runner
COPY docker/test-runner.mjs ./

CMD ["node", "test-runner.mjs"]
