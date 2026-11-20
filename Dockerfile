FROM node:22-alpine
WORKDIR /app
COPY server.js overlay.html customize.html ./
RUN mkdir /data && chown node:node /data
ENV NODE_ENV=production DATA_DIR=/data HOST=0.0.0.0 PORT=3000
VOLUME /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
