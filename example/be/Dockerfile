# Built by `variant up` with the worktree (the example directory) as the build context.
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lock ./
COPY be/package.json be/
COPY fe/package.json fe/
RUN bun install --frozen-lockfile --production
COPY be/ be/
WORKDIR /app/be
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "src/main.ts"]
