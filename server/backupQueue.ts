import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
let BetterSqlite3: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  BetterSqlite3 = require('better-sqlite3');
} catch (e) {
  BetterSqlite3 = null;
}
let PgClient: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('pg');
  PgClient = pkg.Client || pkg.default?.Client || pkg.default || pkg;
} catch (e) {
  PgClient = null;
}

type TaskStatus = 'pending' | 'in_progress' | 'failed' | 'done';

class BackupQueue {
  db: any | null = null;
  workerRunning = false;
  interval = 3000; // 3s

  constructor() {
    if (!BetterSqlite3) {
      console.warn('better-sqlite3 not installed; backup queue disabled');
      return;
    }
    const dbPath = path.resolve(process.cwd(), '.data', 'backup_queue.sqlite');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new BetterSqlite3(dbPath);
    this._migrate();
    this.startWorker();
  }

  _migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backup_tasks (
        id TEXT PRIMARY KEY,
        conn TEXT NOT NULL,
        sql TEXT NOT NULL,
        params TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        next_try_at INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `);
  }

  enqueue(conn: string, sql: string, params: any[]) {
    if (!this.db) return null;
    const id = randomUUID();
    const now = Date.now();
    const stmt = this.db.prepare(`INSERT INTO backup_tasks (id,conn,sql,params,attempts,status,next_try_at,created_at) VALUES (?,?,?,?,?,?,?,?)`);
    stmt.run(id, conn, sql, JSON.stringify(params || []), 0, 'pending', 0, now);
    return id;
  }

  list(limit = 100) {
    if (!this.db) return [];
    return this.db.prepare(`SELECT * FROM backup_tasks ORDER BY created_at DESC LIMIT ?`).all(limit).map((r: any) => ({
      ...r,
      params: r.params ? JSON.parse(r.params) : [],
    }));
  }

  startWorker() {
    if (!this.db || !PgClient) return;
    if (this.workerRunning) return;
    this.workerRunning = true;
    const pick = this.db.prepare(`SELECT * FROM backup_tasks WHERE status IN ('pending','failed') AND next_try_at <= ? ORDER BY created_at ASC LIMIT 5`);
    const markInProgress = this.db.prepare(`UPDATE backup_tasks SET status='in_progress' WHERE id = ? AND status != 'done'`);
    const markDone = this.db.prepare(`UPDATE backup_tasks SET status='done' WHERE id = ?`);
    const updateFail = this.db.prepare(`UPDATE backup_tasks SET attempts = ?, last_error = ?, status = 'failed', next_try_at = ? WHERE id = ?`);

    const worker = async () => {
      try {
        const now = Date.now();
        const tasks = pick.all(now);
        for (const t of tasks) {
          markInProgress.run(t.id);
          const params = t.params ? JSON.parse(t.params) : [];
          const client = new PgClient({ connectionString: t.conn });
          try {
            await client.connect();
            await client.query(t.sql, params);
            await client.end();
            markDone.run(t.id);
          } catch (e: any) {
            try { await client.end(); } catch {};
            const attempts = (t.attempts || 0) + 1;
            // exponential backoff in ms
            const backoff = Math.min(3600 * 1000, Math.pow(2, attempts) * 1000);
            const nextTry = Date.now() + backoff;
            updateFail.run(attempts, (e && e.message) ? e.message : String(e), nextTry, t.id);
          }
        }
      } catch (e) {
        console.error('BackupQueue worker error', e);
      } finally {
        setTimeout(worker, this.interval);
      }
    };

    worker();
  }
}

const singleton = new BackupQueue();
export default singleton;
