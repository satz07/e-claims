import { useReadContract } from 'wagmi'
import { CONTRACT_ADDRESS, UPSERT_CLAIM_ABI } from '@/lib/contracts'

export function useDynamicContractRead({
  functionName,
  args = [],
  enabled = true,
}: {
  functionName: string
  args?: any[]
  enabled?: boolean
}) {
  const { data, isLoading, isError, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: UPSERT_CLAIM_ABI,
    functionName: functionName as any,
    args,
    query: { enabled: enabled && args.length > 0 },
  })
  return { data, isLoading, isError, refetch }
}
