FROM node:22-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json .
RUN npm install --omit=dev

# Copy application code (no .env — secrets come from Cloud Run env vars)
COPY . .

# Cloud Run injects PORT; default to 8080
ENV PORT=8080

EXPOSE 8080

# Start the application
CMD ["node", "index.js"]
