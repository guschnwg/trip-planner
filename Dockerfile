FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY ./src ./src
COPY --from=frontend-build /app/src/static ./src/static
EXPOSE 3000
CMD ["npm", "start"]
