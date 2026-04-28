# Werecloud ioT NanoMQ Dashboard

Werecloud ioT NanoMQ Dashboard is a web-based administration console for NanoMQ. It helps operators connect to a NanoMQ HTTP API endpoint, monitor broker health, inspect clients and subscriptions, publish test messages, and manage common IoT gateway operations from a clean browser interface.

The project is built with Vue 3, TypeScript, Vite, Pinia, Vue Router, Vue I18n, and Arco Design Vue.

## Features

- Connect to a NanoMQ API server with URL, username, and password.
- View dashboard metrics such as connections, traffic, CPU usage, and memory usage.
- Inspect connected clients and active subscriptions.
- Publish MQTT messages from the web console.
- Monitor live metric trends with configurable refresh intervals.
- Manage system configuration, access control, rules, and bridges.
- Run as a static SPA in Docker.
- Build and publish container images automatically with GitHub Actions.

## Requirements

- Node.js 18 recommended
- pnpm
- Docker, for container builds and deployment

Enable pnpm with Corepack:

```bash
corepack enable
```

Install dependencies:

```bash
pnpm install
```

## Configuration

The default NanoMQ API endpoint is configured through a Vite environment variable:

```bash
VITE_NANOMQ_API_URL=http://localhost:8081
```

Environment files:

- `.env.development` is used for local development.
- `.env.production` is used for production builds.

Users can also enter the NanoMQ API URL on the login page. After a successful login, the selected connection settings are stored in the browser.

## Local Development

Start the development server:

```bash
pnpm run dev
```

Run type checking:

```bash
pnpm run typecheck
```

Build for production:

```bash
pnpm run build
```

The production output is generated in `dist/`.

## Docker Usage

The Docker image builds the Vue application with pnpm and serves the generated static files with `miniserve` in SPA mode.

Build the image locally:

```bash
docker build \
  --build-arg VITE_NANOMQ_API_URL=http://localhost:8081 \
  -t nanomq-admin:latest .
```

Run the container:

```bash
docker run -d \
  --name nanomq-admin \
  --restart unless-stopped \
  -p 8080:8080 \
  nanomq-admin:latest
```

Open the dashboard:

```text
http://localhost:8080
```

To point the image at a production NanoMQ API during build:

```bash
docker build \
  --build-arg VITE_NANOMQ_API_URL=https://iot.example.com \
  -t nanomq-admin:latest .
```

Because this is a frontend static build, `VITE_NANOMQ_API_URL` is embedded at build time. If you need to change the default API endpoint baked into the image, rebuild the image with a new build argument. Users can still override the endpoint from the login page at runtime.

### Repository Variable

To configure the default NanoMQ API URL used by the production image, add a GitHub Actions repository variable:

```text
NANOMQ_API_URL=https://iot.example.com
```

You can add it in:

```text
Settings -> Secrets and variables -> Actions -> Variables
```

The current workflow reads the repository variable as:

```yaml
build-args: |
  NANOMQ_API_URL=${{ vars.NANOMQ_API_URL }}
```

The Dockerfile expects this build argument:

```text
VITE_NANOMQ_API_URL
```

To bake the default API URL into the production image, make sure `.github/workflows/deploy.yml` maps the repository variable to the Dockerfile argument:

```yaml
build-args: |
  VITE_NANOMQ_API_URL=${{ vars.NANOMQ_API_URL }}
```

## Running in docker

After the workflow pushes the image to GHCR, users can deploy it on any server with Docker installed.

Pull the latest image:

```bash
docker pull ghcr.io/werecloud/nanomq-admin:latest
```

Start the dashboard:

```bash
docker run -d \
  --name nanomq-admin \
  --restart unless-stopped \
  -p 8080:8080 \
  ghcr.io/werecloud/nanomq-admin:latest
```

Upgrade an existing deployment:

```bash
docker pull ghcr.io/werecloud/nanomq-admin:latest
docker stop nanomq-admin || true
docker rm nanomq-admin || true
docker run -d \
  --name nanomq-admin \
  --restart unless-stopped \
  -p 8080:8080 \
  ghcr.io/werecloud/nanomq-admin:latest
```

Then open:

```text
http://SERVER_IP:8080
```

## Project Structure

```text
src/
  api/                  API and NanoMQ connection logic
  assets/               Static assets
  components/           Shared UI components
  locale/               Internationalization messages
  router/               Routes and menu configuration
  store/                Pinia stores
  views/                Page modules
config/                 Vite configuration
.github/workflows/      GitHub Actions workflows
Dockerfile              Docker image definition
```

## License

MIT

## Copyright
Werecloud Inc.