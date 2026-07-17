import path from "node:path";
import { fileURLToPath } from "node:url";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import dotenv from "dotenv";
import { gweiToWei, resolveNetwork } from "./networks.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

function deployerAccounts() {
  const raw = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!raw) return [];
  let k = String(raw).trim().replace(/^['"]|['"]$/g, "");
  if (!k.startsWith("0x")) k = `0x${k}`;
  return [k];
}

function hardhatNetworkFromKey(key) {
  const net = resolveNetwork(key);
  const envPrefix = net.key.toUpperCase().replace(/-/g, "_");
  const maxFee =
    process.env[`${envPrefix}_MAX_FEE_GWEI`] ||
    process.env.MAX_FEE_GWEI ||
    net.maxFeePerGasGwei;
  const maxPriority =
    process.env[`${envPrefix}_MAX_PRIORITY_GWEI`] ||
    process.env.MAX_PRIORITY_GWEI ||
    net.maxPriorityFeePerGasGwei;

  const rpcOverride =
    process.env[`${envPrefix}_RPC_URL`] ||
    process.env.RPC_URL ||
    (net.key === "spearhead" ? process.env.SPEARHEAD_RPC_URL : undefined);

  return {
    type: "http",
    url: rpcOverride || net.rpcUrl,
    chainId: net.chainId,
    accounts: deployerAccounts(),
    maxFeePerGas: Number(gweiToWei(maxFee)),
    maxPriorityFeePerGas: Number(gweiToWei(maxPriority)),
  };
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
    spearhead: hardhatNetworkFromKey("spearhead"),
    adi: hardhatNetworkFromKey("adi"),
    apeiro: hardhatNetworkFromKey("apeiro"),
    // aliases
    mainnet: hardhatNetworkFromKey("adi"),
    "adi-mainnet": hardhatNetworkFromKey("adi"),
    "apeiro-network": hardhatNetworkFromKey("apeiro"),
  },
};

export default config;
