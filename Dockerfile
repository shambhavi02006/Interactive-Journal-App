# Production Dockerfile for Google Cloud Run
FROM node:20-slim

WORKDIR /app

# Copy dependency definition files
COPY package*.json ./

# Install all dependencies including build tools
RUN npm install

# Copy application source files
COPY . .

# Build static frontend and bundle server.ts to dist/server.cjs
RUN npm run build

# Cloud Run defaults to PORT 8080
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Start production server
CMD ["npm", "start"]
