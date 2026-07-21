/**
 * Authorize a wallet as ClaimRegistryV3 submitter (owner-only).
 *
 * Usage:
 *   node scripts/add-submitter.mjs 0xYourWallet
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvFile(path.join(root, '.env'));

const submitter = process.argv[2];
if (!submitter || !ethers.isAddress(submitter)) {
  console.error('Usage: node scripts/add-submitter.mjs 0xWalletAddress');
  process.exit(1);
}

const RPC =
  process.env.APEIRO_RPC_URL ||
  process.env.CHAIN_RPC_URL ||
  'https://rpc.apeiro.adifoundation.ai';
const CONTRACT =
  process.env.CLAIM_REGISTRY_ADDRESS ||
  '0xC797A6e0c7C2F631F176279980E638FBB255E9B0';
const OWNER_KEY = process.env.OWNER_PRIVATE_KEY || process.env.ECLAIM_PRIVATE_KEY || '';

if (!OWNER_KEY) {
  console.error('OWNER_PRIVATE_KEY / ECLAIM_PRIVATE_KEY missing in .env');
  process.exit(1);
}

const abi = [
  'function addSubmitter(address)',
  'function authorizedSubmitters(address) view returns (bool)',
  'function owner() view returns (address)',
];

const pk = OWNER_KEY.startsWith('0x') ? OWNER_KEY : `0x${OWNER_KEY}`;
const provider = new ethers.JsonRpcProvider(RPC, 37001, { staticNetwork: true });
const wallet = new ethers.Wallet(pk, provider);
const contract = new ethers.Contract(CONTRACT, abi, wallet);

const signer = await wallet.getAddress();
const owner = await contract.owner();
console.log(`contract: ${CONTRACT}`);
console.log(`signer:   ${signer}`);
console.log(`owner:    ${owner}`);

if (signer.toLowerCase() !== owner.toLowerCase()) {
  console.error('Signer is not contract owner — cannot call addSubmitter');
  process.exit(1);
}

const already = await contract.authorizedSubmitters(submitter);
if (already) {
  console.log(`Already authorized: ${submitter}`);
  process.exit(0);
}

console.log(`Adding submitter: ${submitter}`);
const tx = await contract.addSubmitter(submitter);
console.log(`tx: ${tx.hash}`);
const receipt = await tx.wait();
console.log(`status: ${receipt?.status === 1 ? 'success' : 'failed'}`);
console.log(
  `authorized: ${await contract.authorizedSubmitters(submitter)}`,
);
console.log(`explorer: https://explorer.apeiro.adifoundation.ai/tx/${tx.hash}`);
