import type { RegistryKind } from '@/components/hash-registry-page'

export const VERIFIABLE_REGISTRY_ADDRESSES: Record<
  Exclude<RegistryKind, 'provider'>,
  `0x${string}`
> = {
  citizen: (process.env.NEXT_PUBLIC_CITIZEN_REGISTRY_ADDRESS ||
    '0xd646829b3310a17B660079acc7F4A97DBFC9ce2D') as `0x${string}`,
  clinician: (process.env.NEXT_PUBLIC_CLINICIAN_REGISTRY_ADDRESS ||
    '0x64e8Ffca1907B0769Bf02cB60DC62D0e1070a591') as `0x${string}`,
  insurer: (process.env.NEXT_PUBLIC_INSURER_REGISTRY_ADDRESS ||
    '0xe8729132b31c0e1E7683360A4781A3307fb52163') as `0x${string}`,
}

export const VERIFIABLE_REGISTRY_ABI = [
  {
    inputs: [
      { internalType: 'bytes32', name: 'idHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'metaHash', type: 'bytes32' },
      { internalType: 'uint64', name: 'validFrom', type: 'uint64' },
      { internalType: 'uint64', name: 'validTo', type: 'uint64' },
    ],
    name: 'register',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const
