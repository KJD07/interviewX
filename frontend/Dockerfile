FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Every image build (i.e. every redeploy) is linted; an ESLint error stops
# the build here instead of shipping. `npm run lint:fix` fixes what it can.
RUN npm run lint

EXPOSE 3000

CMD ["npm", "run", "dev"]
