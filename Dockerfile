# Use the official Node.js 18 image as a base
FROM node:20

# Copy package.json and package-lock.json for better layer caching
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn

# Copy the rest of the application code
COPY . .


# Expose the port the app runs on
EXPOSE 8000

# Command to run the development server
CMD ["yarn", "dev:server"]
