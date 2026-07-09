/**
 * Transfer ClaimRegistry owner to a new address.
 *
 * Requires .env (same as deploy):
 *   PRIVATE_KEY or DEPLOYER_PRIVATE_KEY — must be the CURRENT owner wallet
 *   CLAIM_REGISTRY_ADDRESS — deployed contract (0x...)
 *   NEW_OWNER — address that will become owner (0x...)
 *
 * Run:
 *   npx hardhat run scripts/transfer-claim-registry-ownership.js --network spearhead
 */
import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  const registry = process.env.CLAIM_REGISTRY_ADDRESS;
  const newOwner = process.env.NEW_OWNER;

  if (!registry || !ethers.isAddress(registry)) {
    throw new Error("Set CLAIM_REGISTRY_ADDRESS to the ClaimRegistry contract (0x...)");
  }
  if (!newOwner || !ethers.isAddress(newOwner)) {
    throw new Error("Set NEW_OWNER to the new owner EOA or multisig (0x...)");
  }

  const [signer] = await ethers.getSigners();
  console.log("Caller (must be current owner):", await signer.getAddress());

  const claimRegistry = await ethers.getContractAt("ClaimRegistry", registry, signer);

  const before = await claimRegistry.owner();
  console.log("Owner before:", before);

  const tx = await claimRegistry.transferOwnership(newOwner);
  console.log("Tx:", tx.hash);
  await tx.wait();

  const after = await claimRegistry.owner();
  console.log("Owner after:", after);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
