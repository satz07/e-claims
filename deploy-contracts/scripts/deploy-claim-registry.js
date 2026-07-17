/**
 * Deploy ClaimRegistry to the selected Hardhat network (--network spearhead|adi).
 * Gas / fee details are appended under deploy-contracts/logs/.
 */
import { network } from "hardhat";
import { resolveNetwork } from "../networks.js";
import { TxAuditLogger, deployAndLog } from "./lib/tx-logger.js";

const connection = await network.create();
const { ethers, networkName } = connection;

async function main() {
  const netMeta = resolveNetwork(networkName);
  const [signer] = await ethers.getSigners();
  const deployer = await signer.getAddress();
  const balance = await ethers.provider.getBalance(deployer);

  const logger = new TxAuditLogger(netMeta, { scriptName: "deploy-claim-registry" });
  logger.logSessionStart(deployer, balance);

  console.log(`Deploying ClaimRegistry on ${netMeta.name} (chain ${netMeta.chainId})…`);

  const { contract, address } = await deployAndLog(ethers, logger, "ClaimRegistry");
  const owner = await contract.owner();
  console.log("owner:", owner);

  const balanceAfter = await ethers.provider.getBalance(deployer);
  logger.logSessionEnd(balanceAfter);

  console.log("\nSet in backend / frontend env:");
  console.log(`CHAIN_NETWORK=${netMeta.key}`);
  console.log(`CLAIM_REGISTRY_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
