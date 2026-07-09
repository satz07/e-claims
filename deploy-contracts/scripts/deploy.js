import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  console.log("SimpleStorage deployment started..");
  const simpleStorage = await ethers.deployContract("SimpleStorage", [
    7n,
    "Hello from Hardhat",
  ]);
  const deploymentTx = simpleStorage.deploymentTransaction();

  if (deploymentTx) {
    console.log("deployment tx hash:", deploymentTx.hash);
    console.log("deployment tx:", deploymentTx);
  }

  console.log("SimpleStorage Waiting for deployment..");

  await simpleStorage.waitForDeployment();

  const contractAddress = await simpleStorage.getAddress();
  const favoriteNumber = await simpleStorage.favoriteNumber();
  const message = await simpleStorage.message();

  console.log("SimpleStorage deployed to:", contractAddress);
  console.log("favoriteNumber:", favoriteNumber.toString());
  console.log("message:", message);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
