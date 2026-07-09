import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  console.log("ProviderRegistry deployment started..");

  const registry = await ethers.deployContract("ProviderRegistry");
  const deploymentTx = registry.deploymentTransaction();

  if (deploymentTx) {
    console.log("deployment tx hash:", deploymentTx.hash);
  }

  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  const owner = await registry.owner();

  console.log("ProviderRegistry deployed to:", contractAddress);
  console.log("owner:", owner);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
