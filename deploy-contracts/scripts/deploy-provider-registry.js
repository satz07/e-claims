/**
 * Deploy ProviderRegistry to the selected Hardhat network (--network spearhead|adi).
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

  const logger = new TxAuditLogger(netMeta, { scriptName: "deploy-provider-registry" });
  logger.logSessionStart(deployer, balance);

  console.log(`Deploying ProviderRegistry on ${netMeta.name} (chain ${netMeta.chainId})…`);

  const { contract, address } = await deployAndLog(ethers, logger, "ProviderRegistry");
  const owner = await contract.owner();
  console.log("owner:", owner);

  logger.logSessionEnd(await ethers.provider.getBalance(deployer));

  console.log("\nSet in backend env:");
  console.log(`PROVIDER_REGISTRY_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
