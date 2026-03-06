FROM node:20-alpine

RUN npm install -g @runcontext/cli @runcontext/mcp

WORKDIR /context
EXPOSE 3000

CMD ["context", "serve", "--http"]
