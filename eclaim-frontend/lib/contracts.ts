export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CLAIM_REGISTRY_ADDRESS ||
  '0x9a6b73f558Bad360a3251C220D383A0f641a58Bc') as `0x${string}`

/** On-chain owner for ClaimRegistry + all registries (only this wallet can write). */
export const CONTRACT_OWNER_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_OWNER_ADDRESS ||
  '0xCb01D9DEc076837eF915E0ffd8d9182264FC5FAE') as `0x${string}`

/** Minimal Claim struct — QA MIS FHIR profile only */
export const UPSERT_CLAIM_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'claimIdHash', type: 'bytes32' },
          { internalType: 'uint256', name: 'claimNumber', type: 'uint256' },
          { internalType: 'bytes32', name: 'bundleIdHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'bundleContentHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'recordUseHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'fidHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'facilityLevelHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'schemeCodeHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'crIdHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'nationalIdHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'claimTypeHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'interventionCodeHash', type: 'bytes32' },
          { internalType: 'uint64', name: 'creationDate', type: 'uint64' },
          { internalType: 'uint64', name: 'dateFrom', type: 'uint64' },
          { internalType: 'uint64', name: 'dateTo', type: 'uint64' },
          { internalType: 'uint256', name: 'claimedTotal', type: 'uint256' },
          { internalType: 'bool', name: 'ipsClaim', type: 'bool' },
          { internalType: 'uint8', name: 'status', type: 'uint8' },
        ],
        internalType: 'struct ClaimRegistry.Claim',
        name: 'c',
        type: 'tuple',
      },
    ],
    name: 'upsertClaim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const
