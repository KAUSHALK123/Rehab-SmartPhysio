FROM node:20-alpine

WORKDIR /frontend

# Install dependencies
COPY package*.json /frontend/
RUN npm install

# Copy application source code
COPY . /frontend/

EXPOSE 5173

# Start development server with host configuration for container accessibility
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
