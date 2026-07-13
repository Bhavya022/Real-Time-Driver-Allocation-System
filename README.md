# Vybe Cabs — Real-Time Driver Allocation (Proof-of-Concept)

This repository contains a minimal implementation of a Real-Time Driver Allocation system demonstrating:

- Redis GEO-based driver search
- Atomic driver assignment using a Redis Lua script (prevents race conditions)
- Timeout/retry allocation windows
- Idempotent accept handling
- A concurrency simulation script that demonstrates multiple drivers accepting simultaneously

Tech: NestJS + TypeScript, Redis, Postgres (docker-compose)

Quick start

1. Start Redis and Postgres:

```bash
docker-compose up -d
```

2. Install dependencies:

```bash
npm install
```

3. Run the server (dev):

```bash
npm run dev
```

4. In another terminal run the concurrency simulation (after server is up):

```bash
npm run test:concurrency
```

API documentation

- Open the interactive API docs in your browser after starting the server:

```bash
http://localhost:3000/api
```

- This Swagger UI page lets you execute requests directly from the browser.

Key endpoints (curl)

- Register/update driver location:

```bash
curl -X POST http://localhost:3000/drivers -H 'Content-Type: application/json' -d '{"id":"d1","lon":77.5946,"lat":12.9716}'
```

- Request a ride:

```bash
curl -X POST http://localhost:3000/rides -H 'Content-Type: application/json' -d '{"lon":77.5946,"lat":12.9716}'
```

- Driver accepts a ride:

```bash
curl -X POST http://localhost:3000/rides/<rideId>/accept \
  -H 'Content-Type: application/json' \
  -d '{"driverId":"d1"}'
```

- Fetch ride status:

```bash
curl http://localhost:3000/rides/<rideId>
```

Design notes

- Geo search: uses Redis GEOADD/GEORADIUS to find nearby drivers and checks their availability via a Redis hash field.
- Concurrency: assignment is handled by a Redis Lua script (`EVAL`) which atomically checks whether `ride:...` already has an `assigned` field and, if not, sets it to the accepting driver. This guarantees only one assignment even under concurrent accepts.
- Timeout & retry: server-side timer windows (8s) are used to wait for accepts; if none occur, the ride moves to `TIMEOUT`. Retry windows are simulated via repeated checks. (In production this would be event-driven / persisted job queue.)
- Idempotency: the Lua script returns `ALREADY_ASSIGNED` if the same driver retries the accept, avoiding duplicate side-effects.

Architecture (simple ASCII)

Rider -> POST /rides -> Redis GEO search -> Candidates list -> notify drivers (simulated) -> multiple drivers POST /rides/:id/accept -> Redis Lua script atomically assigns -> ride state ASSIGNED

What to review

- Source: see `src/` for controllers and services.
- Concurrency verification: `test/simulate_concurrency.js` — run it to see only one driver wins assignment.

Next steps (not implemented here)

- Persist rides and assignments to Postgres
- Real notification delivery (WebSocket/SSE)
- Robust retry/backoff and distributed workers

Automated concurrency test

Run the automated concurrency check which verifies only one driver is assigned (requires Postgres + Redis + server running):

```bash
npm run test:automated
```

Simulating Postgres failure and reconciliation

The server now includes a background reconciler that scans Redis ride records every 10s and repairs Redis/Postgres divergence when a ride is assigned in Redis but missing or inconsistent in Postgres.

To simulate a Postgres failure during assignment and run the reconciliation test, start the server with the environment variable `SIMULATE_PG_FAIL_ON_ASSIGN=1` so PG writes will fail during assignment. Then run:

```bash
# start services
docker-compose up -d
npm install

# start server with PG assignment failures simulated
SIMULATE_PG_FAIL_ON_ASSIGN=1 npm run dev

# in another terminal run the integration test which verifies the server repaired the divergence
npm run test:pg-failure
```


# Real-Time-Driver-Allocation-System