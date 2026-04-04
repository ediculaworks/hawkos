/**
 * Docker log streaming via Unix socket.
 * Uses the Docker HTTP API at /var/run/docker.sock — no docker binary needed.
 * The socket is mounted read-only into the agent container (docker-compose.yml).
 */

import http from 'node:http';

/** Maps service alias → container name as created by docker compose */
const CONTAINER_MAP: Record<string, string> = {
  web: 'hawkos-web-1',
  postgres: 'hawkos-postgres-1',
  pgbouncer: 'hawkos-pgbouncer-1',
  caddy: 'hawkos-caddy-1',
};

export const DOCKER_LOG_SERVICES = Object.keys(CONTAINER_MAP);

/**
 * Stream logs from a docker container via the Docker HTTP API.
 * Calls onData for each log line (stripped of the 8-byte framing header).
 * Stops when signal is aborted.
 */
export function streamDockerLogs(
  service: string,
  tail: number,
  onData: (text: string) => void,
  signal: AbortSignal,
): void {
  const container = CONTAINER_MAP[service];
  if (!container) return;

  const req = http.request(
    {
      socketPath: '/var/run/docker.sock',
      path: `/v1.41/containers/${container}/logs?stdout=true&stderr=true&tail=${tail}&follow=true`,
      method: 'GET',
      headers: { Host: 'docker' },
    },
    (res) => {
      let remainder = Buffer.alloc(0);

      res.on('data', (chunk: Buffer) => {
        const data = Buffer.concat([remainder, chunk]);
        remainder = Buffer.alloc(0);
        let offset = 0;

        while (offset < data.length) {
          // Docker log framing: 8-byte header (1 byte stream type, 3 bytes padding, 4 bytes size)
          if (offset + 8 > data.length) {
            remainder = data.slice(offset);
            break;
          }
          const payloadSize = data.readUInt32BE(offset + 4);
          if (offset + 8 + payloadSize > data.length) {
            remainder = data.slice(offset);
            break;
          }
          const payload = data.slice(offset + 8, offset + 8 + payloadSize);
          const text = payload.toString('utf-8').replace(/\n$/, '');
          if (text) onData(text);
          offset += 8 + payloadSize;
        }
      });

      res.on('error', () => {});
    },
  );

  req.on('error', () => {});
  signal.addEventListener('abort', () => req.destroy(), { once: true });
  req.end();
}
