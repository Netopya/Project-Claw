# Development Dockerfile
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000
EXPOSE 3001

# Start development server
CMD ["npm", "run", "dev"]