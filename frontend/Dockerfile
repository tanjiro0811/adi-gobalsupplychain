# Use official Node base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json* ./

# Install dependencies (use ci if package-lock is present)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy application project
COPY . .

# Build the app (if needed for production, otherwise we can run dev server)
# Since Docker Compose often runs the "dev" version for easy viewing, we can stick to dev or build+serve
# Here we will setup a build + serve for production-like usage, or dev if prefered.
# Assuming standard Vite workflow:
EXPOSE 5173

# We will just run the vite dev server by default so it stays simple, 
# exposing on all interfaces
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
