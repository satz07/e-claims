import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  console.log("ClaimRegistry deployment started..");

  const claimRegistry = await ethers.deployContract("ClaimRegistry");
  const deploymentTx = claimRegistry.deploymentTransaction();

  if (deploymentTx) {
    console.log("deployment tx hash:", deploymentTx.hash);
  }

  console.log("ClaimRegistry waiting for deployment..");

  await claimRegistry.waitForDeployment();

  const contractAddress = await claimRegistry.getAddress();
  const owner = await claimRegistry.owner();

  console.log("ClaimRegistry deployed to:", contractAddress);
  console.log("owner:", owner);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
