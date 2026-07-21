/**
 * Off-chain plaintext ↔ hash map for registry IDs.
 * On-chain stores only keccak256(id); this file lets List/Lookup show originals
 * when we registered (or remembered) the plaintext.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';

const LABEL_FILE = path.join(process.cwd(), 'logs', 'registry-id-labels.json');

const ZERO_HASH = '0x' + '00'.repeat(32);

export type RegistryLabelKind = 'provider' | 'citizen' | 'clinician' | 'insurer';

type LabelStore = {
  updatedAt?: string;
  byHash: Record<string, { kind: RegistryLabelKind; id: string }>;
};

/** Common scheme codes from e-claim DB + demo seeds */
const SEED_IDS: Array<{ kind: RegistryLabelKind; id: string }> = [
  { kind: 'insurer', id: 'CAT-SHA-001' },
  { kind: 'insurer', id: 'SHIF' },
  { kind: 'insurer', id: 'TSC' },
  { kind: 'insurer', id: 'POMSF' },
  { kind: 'insurer', id: 'UHC' },
  { kind: 'insurer', id: 'POMSF-SHA' },
  { kind: 'insurer', id: 'POMSF-047' },
  { kind: 'insurer', id: 'POMSF-010' },
  { kind: 'insurer', id: 'POMSF-SHAT' },
  { kind: 'insurer', id: 'POMSF-KCCS' },
  { kind: 'insurer', id: 'POMSF-KNLS' },
  { kind: 'insurer', id: 'EMPLOYED' },
  { kind: 'insurer', id: 'CIVIL_SERVANT' },
  { kind: 'insurer', id: 'TEACHERS' },
  { kind: 'insurer', id: 'SELF_EMPLOYED' },
  { kind: 'provider', id: 'FID-35-108719-7' },
  { kind: 'citizen', id: 'CR3248022528592-4' },
  { kind: 'clinician', id: 'CMP-DEMO-001' },
];

function h(s: string): string {
  if (!s) return ZERO_HASH;
  return ethers.keccak256(ethers.toUtf8Bytes(s));
}

function emptyStore(): LabelStore {
  return { byHash: {} };
}

let cache: LabelStore | null = null;

function loadStore(): LabelStore {
  if (cache) return cache;
  let store = emptyStore();
  try {
    if (fs.existsSync(LABEL_FILE)) {
      store = { ...emptyStore(), ...JSON.parse(fs.readFileSync(LABEL_FILE, 'utf8')) };
      store.byHash = store.byHash || {};
    }
  } catch {
    store = emptyStore();
  }

  // Seed known IDs (does not overwrite existing)
  for (const row of SEED_IDS) {
    const key = h(row.id).toLowerCase();
    if (!store.byHash[key]) {
      store.byHash[key] = { kind: row.kind, id: row.id };
    }
  }

  // Merge ids remembered by seed-from-db cursor if present
  try {
    const cursorPath = path.join(process.cwd(), 'logs', 'db-seed-cursor.json');
    if (fs.existsSync(cursorPath)) {
      const cursor = JSON.parse(fs.readFileSync(cursorPath, 'utf8'));
      const reg = cursor.registered || {};
      for (const id of Object.keys(reg.providers || {})) {
        rememberId('provider', id, store, false);
      }
      for (const id of Object.keys(reg.schemes || {})) {
        rememberId('insurer', id, store, false);
      }
      for (const id of Object.keys(reg.citizens || {})) {
        rememberId('citizen', id, store, false);
      }
    }
  } catch {
    /* ignore */
  }

  cache = store;
  saveStore(store);
  return store;
}

function saveStore(store: LabelStore) {
  try {
    fs.mkdirSync(path.dirname(LABEL_FILE), { recursive: true });
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(LABEL_FILE, JSON.stringify(store, null, 2));
  } catch {
    /* ignore disk errors */
  }
}

export function rememberId(
  kind: RegistryLabelKind,
  id: string,
  store?: LabelStore,
  persist = true,
) {
  if (!id?.trim()) return;
  const s = store || loadStore();
  const key = h(id.trim()).toLowerCase();
  s.byHash[key] = { kind, id: id.trim() };
  if (persist) {
    cache = s;
    saveStore(s);
  }
}

export function resolveIdLabel(
  kind: RegistryLabelKind,
  idHash: string,
): string | null {
  const s = loadStore();
  const row = s.byHash[String(idHash).toLowerCase()];
  if (row && row.kind === kind) return row.id;
  if (row) return row.id; // allow cross-kind if hash matches
  return null;
}

export function hashId(id: string): string {
  return h(id);
}
