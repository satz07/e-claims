/** ClaimRegistry V3 Claim — matches backend buildClaimStruct / CLAIM_REGISTRY.json */
export type PreparedClaimStruct = {
  claimIdHash: `0x${string}`
  claimNumber: string
  claimTypeHash: `0x${string}`
  providerNameHash: `0x${string}`
  providerLevelHash: `0x${string}`
  patientNameHash: `0x${string}`
  accessCodeHash: `0x${string}`
  bundleIdHash: `0x${string}`
  crIdHash: `0x${string}`
  externalIdHash: `0x${string}`
  shaCodeHash: `0x${string}`
  shaPackageCodeHash: `0x${string}`
  claimCodeHash: `0x${string}`
  creationDate: string
  dateFrom: string
  dateTo: string
  dateProcessed: string
  claimedTotal: string
  approvedTotal: string
  adjustment: string
  hasApprovedTotal: boolean
  hasAdjustment: boolean
  hasDateProcessed: boolean
  auditFlag: boolean
  ipsClaim: boolean
  nationalIdHash: `0x${string}`
  guaranteeIdHash: `0x${string}`
  explanationHash: `0x${string}`
  rejectionReasonHash: `0x${string}`
  status: number
  surveillanceStatus: number
  colourCodeHash: `0x${string}`
  count: string
}

const ZERO =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

function hex(v: string | undefined): `0x${string}` {
  return (v || ZERO) as `0x${string}`
}

/** Tuple for ClaimRegistryV3.upsertClaim */
export function claimStructTuple(s: PreparedClaimStruct) {
  if (!s?.claimIdHash) {
    throw new Error('Invalid prepare response: missing claimStruct (check backend / registries)')
  }
  return {
    claimIdHash: hex(s.claimIdHash),
    claimNumber: BigInt(s.claimNumber),
    claimTypeHash: hex(s.claimTypeHash),
    providerNameHash: hex(s.providerNameHash),
    providerLevelHash: hex(s.providerLevelHash),
    patientNameHash: hex(s.patientNameHash),
    accessCodeHash: hex(s.accessCodeHash),
    bundleIdHash: hex(s.bundleIdHash),
    crIdHash: hex(s.crIdHash),
    externalIdHash: hex(s.externalIdHash),
    shaCodeHash: hex(s.shaCodeHash),
    shaPackageCodeHash: hex(s.shaPackageCodeHash),
    claimCodeHash: hex(s.claimCodeHash),
    creationDate: BigInt(s.creationDate || 0),
    dateFrom: BigInt(s.dateFrom || 0),
    dateTo: BigInt(s.dateTo || 0),
    dateProcessed: BigInt(s.dateProcessed || 0),
    claimedTotal: BigInt(s.claimedTotal || 0),
    approvedTotal: BigInt(s.approvedTotal || 0),
    adjustment: BigInt(s.adjustment || 0),
    hasApprovedTotal: !!s.hasApprovedTotal,
    hasAdjustment: !!s.hasAdjustment,
    hasDateProcessed: !!s.hasDateProcessed,
    auditFlag: !!s.auditFlag,
    ipsClaim: !!s.ipsClaim,
    nationalIdHash: hex(s.nationalIdHash),
    guaranteeIdHash: hex(s.guaranteeIdHash),
    explanationHash: hex(s.explanationHash),
    rejectionReasonHash: hex(s.rejectionReasonHash),
    status: Number(s.status ?? 0),
    surveillanceStatus: Number(s.surveillanceStatus ?? 0),
    colourCodeHash: hex(s.colourCodeHash),
    count: BigInt(s.count || 0),
  } as const
}
