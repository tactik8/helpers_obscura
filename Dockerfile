# Use the official Node.js LTS image based on Alpine Linux for a lightweight container
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package dependency manifests first (for optimal Docker layer caching)
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy the rest of the application source code
COPY . .

# Expose the port the Express app runs on
EXPOSE 3017

# Run the app as a non-root user for security
USER node

# Command to start the server
CMD ["npm", "run", "server"]