import type { RegistryKind } from '@/components/hash-registry-page'

export const VERIFIABLE_REGISTRY_ADDRESSES: Record<
  Exclude<RegistryKind, 'provider'>,
  `0x${string}`
> = {
  citizen: (process.env.NEXT_PUBLIC_CITIZEN_REGISTRY_ADDRESS ||
    '0xA6630ABf26203fD7DA2e1Ea326B0C2DAF4e90281') as `0x${string}`,
  clinician: (process.env.NEXT_PUBLIC_CLINICIAN_REGISTRY_ADDRESS ||
    '0xCe8E44ef911072337147b8232506EC6188c86894') as `0x${string}`,
  insurer: (process.env.NEXT_PUBLIC_INSURER_REGISTRY_ADDRESS ||
    '0x84eceD2F5fD90275454B5F4af3317Ea88F483CF7') as `0x${string}`,
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
