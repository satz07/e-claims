/**
 * Shared IDA client — configure via environment variables:
 *
 *   IDA_API_URL   Base URL of the IDA API   (default: http://localhost:8080)
 *   IDA_API_KEY   API key                    (default: dev-api-key)
 *
 * On-chain (self-sovereign) config — only needed for step 07:
 *   RPC_URL              ADI JSON-RPC       (default: https://rpc.adifoundation.ai/)
 *   CHAIN_ID             EIP-155 chain id   (default: 36900 — ADI mainnet)
 *   DID_REGISTRY         DIDRegistry addr   (default: ADI mainnet address)
 *   AGENT_TRUST_REGISTRY AgentTrustRegistry addr (default: ADI mainnet address)
 */
import { IDAClient } from '@myida/sdk';

/**
 * Exported so examples can reach endpoints the SDK does not wrap yet — the
 * label-filtered agent listing in step 02, for instance. Prefer a client
 * method where one exists.
 */
export const apiUrl = process.env.IDA_API_URL ?? 'http://localhost:8080';
export const apiKey = process.env.IDA_API_KEY ?? 'dev-api-key';

/**
 * The API accepts either a service key or a user JWT on the same header and
 * picks the scheme from the token's shape, exactly as the SDK does internally.
 */
export const authHeader = apiKey.startsWith('eyJ') ? `Bearer ${apiKey}` : `ApiKey ${apiKey}`;

export const client = new IDAClient({
  apiUrl,
  apiKey,
  chain: {
    rpcUrl:             process.env.RPC_URL ?? 'https://rpc.adifoundation.ai/',
    chainId:            Number(process.env.CHAIN_ID ?? 36900),
    didRegistry:        process.env.DID_REGISTRY ?? '0xa867Be733ab382a3491bC2A3Bff95F98eEb403b1',
    agentTrustRegistry: process.env.AGENT_TRUST_REGISTRY ?? '0xAb8066df5D28a924a079Fc47Fa7b4ad338FA160B',
  },
});
