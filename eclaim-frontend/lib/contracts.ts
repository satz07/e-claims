export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CLAIM_REGISTRY_ADDRESS ||
  '0x9a6b73f558Bad360a3251C220D383A0f641a58Bc') as `0x${string}`

/** On-chain owner for ClaimRegistry + all registries (only this wallet can write). */
export const CONTRACT_OWNER_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_OWNER_ADDRESS ||
  '0xCb01D9DEc076837eF915E0ffd8d9182264FC5FAE') as `0x${string}`

/** ClaimRegistry V3 Claim — must match CLAIM_REGISTRY.json / buildClaimStruct */
const CLAIM_V3_COMPONENTS = [
  { internalType: 'bytes32', name: 'claimIdHash', type: 'bytes32' },
  { internalType: 'uint256', name: 'claimNumber', type: 'uint256' },
  { internalType: 'bytes32', name: 'claimTypeHash', type: 'bytes32' },
  { internalType: 'bytes32', name: 'providerNameHash', type: 'bytes32' },
  { internalType: 'bytes32', name: 'providerLevelHash', type: 'bytes32' },
  { internalType: 'bytes32', name: 'patientNameHash', type: 'bytes32' },
  { internalType: 'bytes32', name: 'accessCodeHash', type: 'bytes32' },
  { internalType: 'bytes32', name: 'bundleIdHash', type: 'bytes32' },
  { internalType: 'bytes32', name: 'crIdHash', type: 'bytes32' },
  { internalType: 'bytes32', name: 'externalIdHash', type: 'bytes32' },
  { internalType: 'bytes32', name: 'shaCodeHash', type: 'bytes32' },
  { internalType: 'bytes32', name: 'shaPackageCodeHash', type: 'bytes32' },
  { internalType: 'bytes32', name: 'claimCodeHash', type: 'bytes32' },
  { internalType: 'uint64', name: 'creationDate', type: 'uint64' },
  { internalType: 'uint64', name: 'dateFrom', type: 'uint64' },
  { internalType: 'uint64', name: 'dateTo', type: 'uint64' },
  { internalType: 'uint64', name: 'dateProcessed', type: 'uint64' },
  { internalType: 'uint256', name: 'claimedTotal', type: 'uint256' },
  { internalType: 'uint256', name: 'approvedTotal', type: 'uint256' },
  { internalType: 'uint256', name: 'adjustment', type: 'uint256' },
  { internalType: 'bool', name: 'hasApprovedTotal', type: 'bool' },
  { internalType: 'bool', name: 'hasAdjustment', type: 'bool' },
  { internalType: 'bool', name: 'hasDateProcessed', type: 'bool' },
  { internalType: 'bool', name: 'auditFlag', type: 'bool' },
  { internalType: 'bool', name: 'ipsClaim', type: 'bool' },
  { internalType: 'bytes32', name: 'nationalIdHash', type: 'bytes32' },
  { internalType: 'bytes32', name: 'guaranteeIdHash', type: 'bytes32' },
  { internalType: 'bytes32', name: 'explanationHash', type: 'bytes32' },
  { internalType: 'bytes32', name: 'rejectionReasonHash', type: 'bytes32' },
  { internalType: 'uint8', name: 'status', type: 'uint8' },
  { internalType: 'uint8', name: 'surveillanceStatus', type: 'uint8' },
  { internalType: 'bytes32', name: 'colourCodeHash', type: 'bytes32' },
  { internalType: 'uint256', name: 'count', type: 'uint256' },
] as const

export const UPSERT_CLAIM_ABI = [
  {
    inputs: [
      {
        components: CLAIM_V3_COMPONENTS,
        internalType: 'struct ClaimRegistryV3.Claim',
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
