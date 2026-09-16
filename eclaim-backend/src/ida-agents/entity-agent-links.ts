/**
 * Off-chain map: registry entity (citizen/clinician/insurer/provider) ↔ IDA agent.
 */
import * as fs from 'fs';
import * as path from 'path';

export type EntityType = 'citizen' | 'clinician' | 'insurer' | 'provider';

export type EntityAgentRecord = {
  entityType: EntityType;
  entityId: string;
  name: string;
  operatorDid: string;
  agentDid: string;
  trustScore?: number;
  autonomyLevel?: string | number;
  labels?: Record<string, string>;
  registerTxHash?: string;
  registerBlockNumber?: number;
  ibctSigningKeyHex?: string;
  createdAt: string;
  updatedAt: string;
};

type LinkStore = {
  updatedAt?: string;
  byAgentDid: Record<string, EntityAgentRecord>;
  byEntityKey: Record<string, string>; // entityType:entityId -> agentDid
};

const LINK_FILE = path.join(process.cwd(), 'logs', 'entity-agent-links.json');

let cache: LinkStore | null = null;

function emptyStore(): LinkStore {
  return { byAgentDid: {}, byEntityKey: {} };
}

function entityKey(entityType: EntityType, entityId: string): string {
  return `${entityType}:${entityId.trim()}`;
}

function loadStore(): LinkStore {
  if (cache) return cache;
  let store = emptyStore();
  try {
    if (fs.existsSync(LINK_FILE)) {
      store = { ...emptyStore(), ...JSON.parse(fs.readFileSync(LINK_FILE, 'utf8')) };
      store.byAgentDid = store.byAgentDid || {};
      store.byEntityKey = store.byEntityKey || {};
    }
  } catch {
    store = emptyStore();
  }
  cache = store;
  return store;
}

function saveStore(store: LinkStore) {
  try {
    fs.mkdirSync(path.dirname(LINK_FILE), { recursive: true });
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(LINK_FILE, JSON.stringify(store, null, 2));
    cache = store;
  } catch {
    /* ignore disk errors */
  }
}

export function rememberEntityAgent(
  record: Omit<EntityAgentRecord, 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
  },
): EntityAgentRecord {
  const store = loadStore();
  const now = new Date().toISOString();
  const key = entityKey(record.entityType, record.entityId);
  const existing = store.byAgentDid[record.agentDid];
  const row: EntityAgentRecord = {
    ...record,
    createdAt: existing?.createdAt || record.createdAt || now,
    updatedAt: now,
  };
  store.byAgentDid[record.agentDid] = row;
  store.byEntityKey[key] = record.agentDid;
  saveStore(store);
  return row;
}

export function getEntityAgentByDid(agentDid: string): EntityAgentRecord | null {
  const store = loadStore();
  return store.byAgentDid[agentDid] || null;
}

export function getEntityAgent(
  entityType: EntityType,
  entityId: string,
): EntityAgentRecord | null {
  const store = loadStore();
  const did = store.byEntityKey[entityKey(entityType, entityId)];
  if (!did) return null;
  return store.byAgentDid[did] || null;
}

export function listEntityAgents(): EntityAgentRecord[] {
  const store = loadStore();
  return Object.values(store.byAgentDid).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
