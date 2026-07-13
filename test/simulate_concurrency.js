const axios = require('axios');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const base = process.env.BASE || 'http://localhost:3000';

  // create drivers
  const drivers = ['d1','d2','d3','d4','d5'];
  for (const id of drivers) {
    await axios.post(`${base}/drivers`, { id, lon: 77.5946, lat: 12.9716 });
  }

  // request ride at nearby location
  const resp = await axios.post(`${base}/rides`, { lon: 77.5946, lat: 12.9716 });
  console.log('ride created', resp.data);
  const rideId = resp.data.rideId;

  // wait small amount then simultaneously accept from multiple drivers
  await sleep(200);

  const acceptPromises = drivers.map((d, i) => {
    // small random delay to simulate race
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
  console.log('accept results');
  console.log(results);

  // final ride state
  const final = await axios.get(`${base}/rides/${rideId}`);
  console.log('final ride state', final.data);
}

main().catch(console.error);
