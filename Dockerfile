# ============================================
# Dockerfile - Build image for Node.js backend
# ============================================

# Start from official Node.js image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package.json and package-lock.json
COPY backend/package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY backend/ .

# Expose port that backend listens on
EXPOSE 4000

# Health check - ensures container is working
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000', (r) => {if (r.statusCode !== 404) throw new Error(r.statusCode)})"

# Start the application
CMD ["node", "server.js"]
