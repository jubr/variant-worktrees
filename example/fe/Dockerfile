# Built by `variant up` with the worktree (the example directory) as the build context.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY be/package.json be/
COPY fe/package.json fe/
RUN bun install --frozen-lockfile
COPY fe/ fe/
WORKDIR /app/fe
RUN bun run build

FROM nginx:alpine
# nginx renders /etc/nginx/templates/*.template with envsubst when it starts; only VARIANT_* variables are replaced,
# so the nginx variables ($uri, $host, ...) stay. `variant up` passes VARIANT_SLUG to every container.
ENV NGINX_ENVSUBST_FILTER=VARIANT_
COPY fe/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/fe/dist /usr/share/nginx/html
