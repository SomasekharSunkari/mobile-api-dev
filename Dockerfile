FROM node:24-alpine AS build

# Install dependencies required for build
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev build-base libjpeg-turbo-dev libpng-dev libuuid

WORKDIR /usr/src/app

# Copy package files first for better layer caching
COPY --chown=node:node package.json yarn.lock ./

# Install all dependencies for build
RUN yarn install --frozen-lockfile

# Copy application code
COPY --chown=node:node . .

# Build the application
RUN yarn build

# Set production environment
ENV NODE_ENV=production

# Install only production dependencies
RUN yarn install --frozen-lockfile --production && yarn cache clean --force

###################
# PRODUCTION
###################

FROM node:24-alpine AS production

# Update apk
RUN apk update && apk upgrade

# Install runtime dependencies only
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev

WORKDIR /home/payment-core

# Copy only production node_modules and built code from build stage
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist
COPY --chown=node:node --from=build /usr/src/app/src/resources ./src/resources
COPY --chown=node:node --from=build /usr/src/app/git-commit.json ./git-commit.json

# Switch to non-root user for better security
USER node

# Expose port 7001 for ECS
EXPOSE 7001

# Start the application
CMD ["node", "dist/src/main.js"]