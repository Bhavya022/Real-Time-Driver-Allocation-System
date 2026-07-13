const axios = require('axios');
const Redis = require('ioredis');
const { Pool } = require('pg');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const base = process.env.BASE || 'http://localhost:3000';
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const pgConn = process.env.DATABASE_URL || 'postgresql://vybe:vybe@127.0.0.1:5432/vybe';

  const redis = new Redis(redisUrl);
  const pool = new Pool({ connectionString: pgConn });

  // create drivers
  const drivers = ['x1','x2','x3'];
  for (const id of drivers) {
    await axios.post(`${base}/drivers`, { id, lon: 77.5946, lat: 12.9716 });
  }

  // create ride
  const resp = await axios.post(`${base}/rides`, { lon: 77.5946, lat: 12.9716 });
  const rideId = resp.data.rideId;
  console.log('rideId', rideId);

  // accept from one driver
  await sleep(200);
  const acceptResp = await axios.post(`${base}/rides/${rideId}/accept`, { driverId: drivers[0] });
  console.log('accept response', acceptResp.data);

  // give small time for server-side PG attempt (which may fail under SIMULATE flag)
  await sleep(200);

  const rideKey = `ride:${rideId}`;
  const redisAssigned = await redis.hget(rideKey, 'assigned');
  console.log('Redis assigned:', redisAssigned);

  if (!redisAssigned) {
    console.error('Test failed: Redis did not record assignment');
    process.exit(2);
  }

  const timeoutMs = 30000;
  const start = Date.now();
  let finalAssigned = null;
  while (Date.now() - start < timeoutMs) {
    const q = await pool.query('SELECT assigned_driver FROM rides WHERE id=$1', [rideId]);
    finalAssigned = q.rows[0] ? q.rows[0].assigned_driver : null;
    if (finalAssigned === redisAssigned) {
      break;
    }
    await sleep(1000);
  }

  console.log('Final Postgres assigned_driver:', finalAssigned);

  if (!finalAssigned) {
    console.error('Test failed: assignment not present in Postgres after server reconciliation');
    process.exit(2);
  }

  if (finalAssigned !== redisAssigned) {
    console.error('Test failed: Postgres assignment does not match Redis assignment');
    process.exit(3);
  }

  console.log('Integration test passed: server reconciled Redis/Postgres divergence');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
