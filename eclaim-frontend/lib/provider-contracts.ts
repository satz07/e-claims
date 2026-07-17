export const PROVIDER_REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_PROVIDER_REGISTRY_ADDRESS ||
  '0x03f6849d7c37aF5E8535FFE6E10d4B6e3F44e8E8') as `0x${string}`

export const PROVIDER_REGISTRY_ABI = [
  {
    inputs: [
      { internalType: 'bytes32', name: 'providerIdHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'nameHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'levelHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'countyHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'facilityTypeHash', type: 'bytes32' },
      { internalType: 'uint64', name: 'licenseValidFrom', type: 'uint64' },
      { internalType: 'uint64', name: 'licenseValidTo', type: 'uint64' },
    ],
    name: 'registerProvider',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'providerIdHash', type: 'bytes32' }],
    name: 'deregisterProvider',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'providerIdHash', type: 'bytes32' }],
    name: 'suspendProvider',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'providerIdHash', type: 'bytes32' }],
    name: 'reactivateProvider',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'providerIdHash', type: 'bytes32' },
      { internalType: 'uint64', name: 'licenseValidFrom', type: 'uint64' },
      { internalType: 'uint64', name: 'licenseValidTo', type: 'uint64' },
    ],
    name: 'updateLicense',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'providerIdHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'newLevelHash', type: 'bytes32' },
    ],
    name: 'setProviderTier',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'providerIdHash', type: 'bytes32' }],
    name: 'getProvider',
    outputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'providerIdHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'nameHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'levelHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'countyHash', type: 'bytes32' },
          { internalType: 'bytes32', name: 'facilityTypeHash', type: 'bytes32' },
          { internalType: 'uint64', name: 'licenseValidFrom', type: 'uint64' },
          { internalType: 'uint64', name: 'licenseValidTo', type: 'uint64' },
          { internalType: 'uint8', name: 'status', type: 'uint8' },
          { internalType: 'uint64', name: 'registeredAt', type: 'uint64' },
          { internalType: 'uint64', name: 'updatedAt', type: 'uint64' },
        ],
        internalType: 'struct ProviderRegistry.Provider',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'providerIdHash', type: 'bytes32' },
      { internalType: 'uint64', name: 'atTime', type: 'uint64' },
    ],
    name: 'isProviderAuthorized',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const
