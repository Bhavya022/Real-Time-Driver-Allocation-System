const axios = require('axios');
const { Pool } = require('pg');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const base = process.env.BASE || 'http://localhost:3000';
  const pgConn = process.env.DATABASE_URL || 'postgresql://vybe:vybe@127.0.0.1:5432/vybe';
  const pool = new Pool({ connectionString: pgConn });

  // ensure drivers
  const drivers = ['dA','dB','dC','dD','dE'];
  for (const id of drivers) {
    await axios.post(`${base}/drivers`, { id, lon: 77.5946, lat: 12.9716 });
  }

  const resp = await axios.post(`${base}/rides`, { lon: 77.5946, lat: 12.9716 });
  const rideId = resp.data.rideId;
  console.log('rideId', rideId);

  await sleep(200);

  const acceptPromises = drivers.map((d) => {
    const delay = Math.floor(Math.random() * 50);
    return new Promise(async (resolve) => {
      await sleep(delay);
      try {
        const r = await axios.post(`${base}/rides/${rideId}/accept`, { driverId: d });
        resolve({ driver: d, res: r.data });
      } catch (err) {
        resolve({ driver: d, err: err.message });
      }
    });
  });

  const results = await Promise.all(acceptPromises);
  console.log('accept results', results);

  // query Postgres for assigned driver
  const q = await pool.query('SELECT assigned_driver FROM rides WHERE id=$1', [rideId]);
  const assigned = q.rows[0] ? q.rows[0].assigned_driver : null;
  console.log('Assigned in Postgres:', assigned);

  const successCount = results.filter(r => r.res && r.res.ok).length;
  console.log('Number of accept responses with ok=true:', successCount);

  if (!assigned) {
    console.error('Test failed: no assigned driver in Postgres');
    process.exit(2);
  }
  if (successCount !== 1) {
    console.error('Test failed: expected exactly 1 successful accept, got', successCount);
    process.exit(3);
  }

  console.log('Test passed: single assignment confirmed');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
