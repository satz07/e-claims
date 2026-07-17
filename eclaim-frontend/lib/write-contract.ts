import {
  publicClient,
  activeChain,
  SPEARHEAD_GAS_OVERRIDES,
} from '@/components/providers/web3-provider'
import { NETWORK_GAS_OVERRIDES, ACTIVE_NETWORK } from '@/lib/network'
import { CONTRACT_OWNER_ADDRESS } from '@/lib/contracts'
import type { Abi, ContractFunctionName } from 'viem'

type WriteContractAsync = (variables: Record<string, unknown>) => Promise<`0x${string}`>

const OWNER_ABI = [
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const METAMASK_TIMEOUT_MS = 180_000

const gasOverrides = NETWORK_GAS_OVERRIDES ?? SPEARHEAD_GAS_OVERRIDES

function shorten(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function parseRevertReason(err: unknown): string | null {
  const e = err as { shortMessage?: string; message?: string; cause?: { reason?: string } }
  const raw = e?.shortMessage || e?.cause?.reason || e?.message || ''
  if (raw.includes('Not owner')) return 'Not owner — switch MetaMask to the contract owner account.'
  if (raw.includes('Already active')) return 'This ID is already registered on-chain.'
  if (raw.includes('User rejected')) return 'Transaction cancelled in MetaMask.'
  return raw ? raw.slice(0, 200) : null
}

async function assertOwnerWallet(account: `0x${string}`, contract: `0x${string}`) {
  const onChainOwner = await publicClient.readContract({
    address: contract,
    abi: OWNER_ABI,
    functionName: 'owner',
  })
  if (onChainOwner.toLowerCase() !== account.toLowerCase()) {
    throw new Error(
      `Connected wallet ${shorten(account)} is not the contract owner. ` +
        `Switch MetaMask to Operator/Admin ${shorten(CONTRACT_OWNER_ADDRESS)} — ` +
        `only that account can write (others revert with "Not owner").`,
    )
  }
}

/**
 * Simulate + MetaMask sign + wait for receipt on the configured chain.
 */
export async function writeContractAndWait(
  writeContractAsync: WriteContractAsync,
  params: Record<string, unknown>,
  account?: `0x${string}`,
): Promise<`0x${string}`> {
  if (!account) {
    throw new Error('Connect MetaMask first.')
  }

  const contractAddress = params.address as `0x${string}`
  const abi = params.abi as Abi
  const functionName = params.functionName as ContractFunctionName
  const args = params.args as readonly unknown[]

  await assertOwnerWallet(account, contractAddress)

  try {
    await publicClient.simulateContract({
      address: contractAddress,
      abi,
      functionName,
      args,
      account,
      chain: activeChain,
    })
  } catch (simErr) {
    const reason = parseRevertReason(simErr)
    throw new Error(
      reason ||
        'Transaction would fail on-chain (simulation error). Check owner wallet, duplicate IDs, and registry setup.',
    )
  }

  const writePromise = writeContractAsync({
    address: contractAddress,
    abi,
    functionName,
    args,
    account,
    maxFeePerGas: gasOverrides.maxFeePerGas,
    maxPriorityFeePerGas: gasOverrides.maxPriorityFeePerGas,
  })

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error('MetaMask confirmation timed out (3 min). Cancel and try again.')),
      METAMASK_TIMEOUT_MS,
    )
  })

  let hash: `0x${string}`
  try {
    hash = await Promise.race([writePromise, timeoutPromise])
  } catch (err) {
    const reason = parseRevertReason(err)
    throw new Error(reason || 'MetaMask transaction failed or was rejected.')
  }

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
    timeout: 120_000,
  })

  if (receipt.status === 'reverted') {
    throw new Error(`Transaction reverted on chain ${ACTIVE_NETWORK.chainId} after mining.`)
  }

  return hash
}
