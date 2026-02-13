import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'audits.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      final_url TEXT,
      overall_score INTEGER,
      status TEXT DEFAULT 'running',
      report_json TEXT,
      html_report TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audits_url ON audits(url);
    CREATE INDEX IF NOT EXISTS idx_audits_created ON audits(created_at);
  `);

  return db;
}

// ============================================================
// Audit CRUD
// ============================================================

export interface AuditRow {
  id: number;
  url: string;
  final_url: string | null;
  overall_score: number | null;
  status: string;
  report_json: string | null;
  html_report: string | null;
  created_at: string;
  completed_at: string | null;
  error: string | null;
}

export function createAudit(url: string): number {
  const db = getDb();
  const result = db.prepare('INSERT INTO audits (url) VALUES (?)').run(url);
  return result.lastInsertRowid as number;
}

export function completeAudit(
  id: number,
  finalUrl: string,
  overallScore: number,
  reportJson: string,
  htmlReport: string
) {
  const db = getDb();
  db.prepare(`
    UPDATE audits SET
      final_url = ?,
      overall_score = ?,
      status = 'complete',
      report_json = ?,
      html_report = ?,
      completed_at = datetime('now')
    WHERE id = ?
  `).run(finalUrl, overallScore, reportJson, htmlReport, id);
}

export function failAudit(id: number, error: string) {
  const db = getDb();
  db.prepare(`
    UPDATE audits SET
      status = 'error',
      error = ?,
      completed_at = datetime('now')
    WHERE id = ?
  `).run(error, id);
}

export function getAudit(id: number): AuditRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM audits WHERE id = ?').get(id) as AuditRow | undefined;
}

export function listAudits(limit = 50): AuditRow[] {
  const db = getDb();
  return db.prepare('SELECT id, url, final_url, overall_score, status, created_at, completed_at, error FROM audits ORDER BY created_at DESC LIMIT ?').all(limit) as AuditRow[];
}

export function deleteAudit(id: number) {
  const db = getDb();
  db.prepare('DELETE FROM audits WHERE id = ?').run(id);
}

// ============================================================
// Settings
// ============================================================

export function getSetting(key: string): string | undefined {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}
