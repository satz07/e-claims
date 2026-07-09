import { keccak256, stringToBytes } from 'viem'

export const ZERO_HASH = `0x${'00'.repeat(32)}` as `0x${string}`

export function hashUtf8(s: string): `0x${string}` {
  if (!s) return ZERO_HASH
  return keccak256(stringToBytes(s))
}

export function toUnix(date: string): bigint {
  return BigInt(Math.floor(new Date(date).getTime() / 1000))
}
