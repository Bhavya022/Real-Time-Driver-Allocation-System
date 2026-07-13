import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class PGService implements OnModuleInit, OnModuleDestroy {
  pool: Pool | null = null;

  async onModuleInit() {
    const connection = process.env.DATABASE_URL || 'postgresql://vybe:vybe@127.0.0.1:5432/vybe';
    this.pool = new Pool({ connectionString: connection });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS rides (
        id UUID PRIMARY KEY,
        state VARCHAR(32) NOT NULL CHECK (state IN ('REQUESTED','SEARCHING','ASSIGNED','TIMEOUT')),
        lon NUMERIC NOT NULL,
        lat NUMERIC NOT NULL,
        assigned_driver TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_rides_assigned_driver ON rides(assigned_driver);
      CREATE INDEX IF NOT EXISTS idx_rides_state_created_at ON rides(state, created_at);
    `);
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async insertRide(id: string, lon: number, lat: number, state = 'SEARCHING') {
    if (!this.pool) throw new Error('PG not initialized');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO rides(id, state, lon, lat) VALUES($1,$2,$3,$4)', [id, state, lon, lat]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async setAssigned(id: string, driverId: string) {
    if (!this.pool) throw new Error('PG not initialized');
    if (process.env.SIMULATE_PG_FAIL_ON_ASSIGN === '1') {
      throw new Error('simulated pg failure');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query('UPDATE rides SET assigned_driver=$1, state=$2 WHERE id=$3 AND assigned_driver IS NULL', [driverId, 'ASSIGNED', id]);
      if (res.rowCount === 1) {
        await client.query('COMMIT');
        return true;
      } else {
        await client.query('ROLLBACK');
        return false;
      }
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getRide(id: string) {
    if (!this.pool) throw new Error('PG not initialized');
    const r = await this.pool.query('SELECT * FROM rides WHERE id=$1', [id]);
    return r.rows[0];
  }

  async reconcileRide(id: string, state: string, lon: number, lat: number, assignedDriver: string) {
    if (!this.pool) throw new Error('PG not initialized');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO rides(id, state, lon, lat, assigned_driver)
         VALUES($1, $2, $3, $4, $5)
         ON CONFLICT(id) DO UPDATE SET
           state = EXCLUDED.state,
           lon = EXCLUDED.lon,
           lat = EXCLUDED.lat,
           assigned_driver = EXCLUDED.assigned_driver`,
        [id, state, lon, lat, assignedDriver],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
