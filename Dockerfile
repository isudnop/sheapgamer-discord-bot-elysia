# use the official Bun image
FROM oven/bun:1 as base
WORKDIR /app

# install dependencies
COPY package.json .
COPY tsconfig.json .
RUN bun install --production

# copy source code
COPY src ./src

# Create the data directory so permissions are correct
RUN mkdir -p /app/data

# Tell app where to look (optional, as defaults work, but good for clarity)
ENV DATA_DIR=/app/data

# run the app
EXPOSE 3000
CMD ["bun", "src/index.ts"]