import { network } from "hardhat";
import fs from "fs";
import path from "path";

const { ethers } = await network.create();

async function deployOne(label) {
  const registry = await ethers.deployContract("VerifiableRegistry");
  const deploymentTx = registry.deploymentTransaction();
  if (deploymentTx) {
    console.log(`${label} deployment tx:`, deploymentTx.hash);
  }
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  const owner = await registry.owner();
  console.log(`${label} deployed:`, address, "owner:", owner);
  return address;
}

async function main() {
  console.log("Deploying VerifiableRegistry instances (citizen, clinician, insurer)...");

  const citizen = await deployOne("CitizenRegistry");
  const clinician = await deployOne("ClinicianRegistry");
  const insurer = await deployOne("InsurerRegistry");

  const out = {
    citizenRegistryAddress: citizen,
    clinicianRegistryAddress: clinician,
    insurerRegistryAddress: insurer,
    network: "spearhead",
    chainId: 99991,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(process.cwd(), "deployed-verifiable-registries.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Wrote", outPath);
  console.log("\nAdd to eclaim-backend/.env:");
  console.log(`CITIZEN_REGISTRY_ADDRESS=${citizen}`);
  console.log(`CLINICIAN_REGISTRY_ADDRESS=${clinician}`);
  console.log(`INSURER_REGISTRY_ADDRESS=${insurer}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
