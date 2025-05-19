# Middle Server

## Before ALL: Deployment GUIDE ON COOLIFY:
Checks:
- Make sure you select First server and the domain name is dev1.koii.network (or second one with dev.koii.network)
- Set the private key to Herman GitHub Key (or other keys have access to middle server repo)
Step:
- Copy all env in developer view from builder247-test to your new service.
- Set Build Pack as docker compose & change docker-compose.yaml to docker-compose.yml
- Setup cron job to run ts-node src/cronJobs/syncDB.ts
=================
A monorepo containing the Middle Server and Orca Agent services.

## Project Structure

The project consists of two main services:

- `middle-server/`: The main server component
- `orca-agent/`: The Orca agent service to support middle server

## Prerequisites

- Node.js
- Yarn
- Docker and Docker Compose

## Getting Started

1. Clone the repository:
```bash
git clone <repository-url>
cd middle-server
```

2. Install dependencies:
```bash
yarn install
```

3. Start the services using Docker Compose:
```bash
docker-compose up -d
```

## Development

The project uses Husky for Git hooks. The hooks are automatically set up when you run `yarn install`.

## Docker Services

The project includes two Docker services:

### Middle Server
- Service name: `middle-server`
- Environment: Production
- Auto-restart: Enabled

### Orca Agent
- Service name: `orca-agent`
- Environment: Production
- Auto-restart: Enabled

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[Add your license information here]
