# Root repository Dockerfile
# Static compliance: <=200 lines, <=20KB, <=30 RUN steps, pinned FROM tag

FROM node:20-slim

WORKDIR /app

# Install git and configure safe directory for VCS operations
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/* \
    && git config --global --add safe.directory /app

# Copy root dependency manifests and install (lockfile-driven, safe per playbook)
COPY package.json package-lock.json ./
RUN npm ci

# Copy mobile dependency manifests and install
COPY mobile/package.json mobile/package-lock.json ./mobile/
RUN cd mobile && npm ci

# Copy full source tree
COPY . .

# Default build command for web verification
CMD ["npm", "run", "build"]
