/**
 * Deploy Citizen / Clinician / Insurer VerifiableRegistry instances.
 * Network: --network spearhead | adi
 */
import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { resolveNetwork } from "../networks.js";
import { TxAuditLogger, deployAndLog } from "./lib/tx-logger.js";

const connection = await network.create();
const { ethers, networkName } = connection;

async function main() {
  const netMeta = resolveNetwork(networkName);
  const [signer] = await ethers.getSigners();
  const deployer = await signer.getAddress();
  const balance = await ethers.provider.getBalance(deployer);

  const logger = new TxAuditLogger(netMeta, {
    scriptName: "deploy-verifiable-registries",
  });
  logger.logSessionStart(deployer, balance);

  console.log(
    `Deploying VerifiableRegistry instances on ${netMeta.name} (chain ${netMeta.chainId})…`,
  );

  const citizen = await deployAndLog(ethers, logger, "VerifiableRegistry");
  console.log("CitizenRegistry:", citizen.address);

  const clinician = await deployAndLog(ethers, logger, "VerifiableRegistry");
  console.log("ClinicianRegistry:", clinician.address);

  const insurer = await deployAndLog(ethers, logger, "VerifiableRegistry");
  console.log("InsurerRegistry:", insurer.address);

  const out = {
    citizenRegistryAddress: citizen.address,
    clinicianRegistryAddress: clinician.address,
    insurerRegistryAddress: insurer.address,
    network: netMeta.key,
    networkName: netMeta.name,
    chainId: netMeta.chainId,
    rpcUrl: netMeta.rpcUrl,
    explorerUrl: netMeta.explorerUrl,
    deployer,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(
    process.cwd(),
    `deployed-verifiable-registries-${netMeta.key}.json`,
  );
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Wrote", outPath);

  logger.logSessionEnd(await ethers.provider.getBalance(deployer));

  console.log("\nAdd to eclaim-backend/.env:");
  console.log(`CHAIN_NETWORK=${netMeta.key}`);
  console.log(`CITIZEN_REGISTRY_ADDRESS=${citizen.address}`);
  console.log(`CLINICIAN_REGISTRY_ADDRESS=${clinician.address}`);
  console.log(`INSURER_REGISTRY_ADDRESS=${insurer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
