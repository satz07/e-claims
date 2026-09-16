/**
 * Seed worker queue helpers — sequential A→Z claim ranges.
 * Used by check-seed-workers.mjs to auto-advance when a range completes.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const QUEUE_PATH = path.join(__dirname, 'seed-worker-queue.json');

export function loadQueue() {
  if (!fs.existsSync(QUEUE_PATH)) return null;
  return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
}

export function saveQueue(q) {
  q.updatedAt = new Date().toISOString();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(q, null, 2) + '\n');
}

/** First pending/running worker, or activeWorker if still pending. */
export function getActiveEntry(q = loadQueue()) {
  if (!q?.workers?.length) return null;
  const byId = q.workers.find(
    (w) =>
      w.id === q.activeWorker &&
      (w.status === 'pending' || w.status === 'running'),
  );
  if (byId) return byId;
  return (
    q.workers.find((w) => w.status === 'pending' || w.status === 'running') ||
    null
  );
}

export function markWorkerStatus(workerId, status, extra = {}) {
  const q = loadQueue();
  if (!q) return null;
  const w = q.workers.find((x) => x.id === workerId);
  if (!w) return null;
  w.status = status;
  Object.assign(w, extra);
  if (status === 'running' || status === 'pending') q.activeWorker = workerId;
  saveQueue(q);
  return w;
}

/**
 * Mark current complete and point activeWorker at next pending.
 * Returns next entry or null if queue finished.
 */
export function advanceAfterComplete(completedId) {
  const q = loadQueue();
  if (!q) return null;
  const cur = q.workers.find((w) => w.id === completedId);
  if (cur) {
    cur.status = 'done';
    cur.completedAt = new Date().toISOString();
  }
  const next = q.workers.find((w) => w.status === 'pending');
  q.activeWorker = next ? next.id : completedId;
  saveQueue(q);
  return next || null;
}

export function queueSummary(q = loadQueue()) {
  if (!q) return 'no queue file';
  const counts = {};
  for (const w of q.workers) {
    counts[w.status] = (counts[w.status] || 0) + 1;
  }
  const active = getActiveEntry(q);
  return `active=${q.activeWorker}${active ? ` (${active.from}→${active.to})` : ''} · ${JSON.stringify(counts)}`;
}
