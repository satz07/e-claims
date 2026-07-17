/**
 * Transfer ClaimRegistry ownership.
 *
 * .env:
 *   PRIVATE_KEY / DEPLOYER_PRIVATE_KEY — current owner
 *   CLAIM_REGISTRY_ADDRESS
 *   NEW_OWNER
 *
 *   npx hardhat run scripts/transfer-claim-registry-ownership.js --network spearhead
 *   npx hardhat run scripts/transfer-claim-registry-ownership.js --network adi
 */
import { network } from "hardhat";
import { resolveNetwork } from "../networks.js";
import { TxAuditLogger } from "./lib/tx-logger.js";

const connection = await network.create();
const { ethers, networkName } = connection;

async function main() {
  const registry = process.env.CLAIM_REGISTRY_ADDRESS;
  const newOwner = process.env.NEW_OWNER;

  if (!registry || !ethers.isAddress(registry)) {
    throw new Error("Set CLAIM_REGISTRY_ADDRESS to the ClaimRegistry contract (0x...)");
  }
  if (!newOwner || !ethers.isAddress(newOwner)) {
    throw new Error("Set NEW_OWNER to the new owner EOA or multisig (0x...)");
  }

  const netMeta = resolveNetwork(networkName);
  const [signer] = await ethers.getSigners();
  const deployer = await signer.getAddress();
  const balance = await ethers.provider.getBalance(deployer);

  const logger = new TxAuditLogger(netMeta, {
    scriptName: "transfer-claim-registry-ownership",
  });
  logger.logSessionStart(deployer, balance);

  const claimRegistry = await ethers.getContractAt("ClaimRegistry", registry, signer);
  const before = await claimRegistry.owner();
  console.log("Owner before:", before);

  const tx = await claimRegistry.transferOwnership(newOwner);
  const receipt = await tx.wait();

  await logger.logTransaction({
    label: "transferOwnership",
    contractName: "ClaimRegistry",
    contractAddress: registry,
    tx,
    receipt,
    provider: ethers.provider,
  });

  const after = await claimRegistry.owner();
  console.log("Owner after:", after);

  logger.logSessionEnd(await ethers.provider.getBalance(deployer));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
