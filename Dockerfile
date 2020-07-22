FROM node:12.16.3-slim

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y \
    git nano && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /erxes-integrations

COPY --chown=node:node . /erxes-integrations

RUN chown -R node:node /erxes-integrations

USER node

RUN yarn

RUN yarn build

EXPOSE 3400

ENTRYPOINT ["node", "--max_old_space_size=8192", "dist"]