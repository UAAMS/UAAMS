# Use a lightweight Node.js base image
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package manifests first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy backend source code (including scripts)
COPY . .

# Add entrypoint to run init/seed scripts at container start (optional)


# Expose the port the app listens on
EXPOSE 5000

CMD ["sh", "-c", "npm run init:postgres && npm run seed && npm start"]