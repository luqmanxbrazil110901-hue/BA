FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build arg so the browser-side API URL is baked in at build time
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8002
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
