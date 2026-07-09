import path from "node:path";
import { fileURLToPath } from "node:url";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

function spearheadAccounts() {
  const raw = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!raw) return [];
  let k = String(raw).trim().replace(/^['"]|['"]$/g, "");
  if (!k.startsWith("0x")) k = `0x${k}`;
  return [k];
}

/** @type {import("hardhat/config").HardhatUserConfig} */
const config = {
  plugins: [hardhatEthers],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    spearhead: {
      type: "http",
      url: process.env.SPEARHEAD_RPC_URL || "https://rpc.spearhead.adifoundation.ai",
      chainId: 99991,
      accounts: spearheadAccounts(),
      maxFeePerGas:         1_000_000_000_000, // 1000 gwei
      maxPriorityFeePerGas:   100_000_000_000, // 100 gwei
    },
  },
};

export default config;