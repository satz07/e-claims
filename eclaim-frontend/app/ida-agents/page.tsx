"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { eclaimApiHeaders } from "@/lib/eclaim-api"

const base = () =>
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001"

type EntityType = "citizen" | "clinician" | "insurer" | "provider" | ""

type EntityAgentRow = {
  entityType?: string | null
  entityId?: string | null
  name?: string
  did?: string
  agentDid?: string
  operatorDid?: string
  labels?: Record<string, string>
  autonomyLevel?: string | number
  trustScore?: number
  createdAt?: string | null
  registerTxHash?: string | null
  registerBlockNumber?: number | null
  ibctSigningKeyHex?: string
}

export default function IdaAgentsPage() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [agents, setAgents] = useState<EntityAgentRow[]>([])
  const [entityFilter, setEntityFilter] = useState<EntityType>("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedDid, setExpandedDid] = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`${base()}/api/public/ida-agents/config`)
      setConfig(await res.json())
    } catch (e: unknown) {
      setConfig({
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }, [])

  const loadAgents = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const q = entityFilter ? `?entityType=${entityFilter}` : ""
      const [idaRes, localRes] = await Promise.all([
        fetch(`${base()}/api/public/ida-agents/list${q}`, {
          headers: eclaimApiHeaders(),
        }),
        fetch(`${base()}/api/public/ida-agents/entities${q}`, {
          headers: eclaimApiHeaders(),
        }),
      ])
      const idaData = await idaRes.json()
      const localData = await localRes.json()
      if (!idaRes.ok && !localRes.ok) {
        throw new Error(idaData?.message || localData?.message || "List failed")
      }

      const byDid = new Map<string, EntityAgentRow>()
      for (const row of (localData.items as EntityAgentRow[]) || []) {
        const did = row.agentDid || row.did
        if (!did) continue
        byDid.set(did, {
          entityType: row.entityType,
          entityId: row.entityId,
          name: row.name,
          did,
          operatorDid: row.operatorDid,
          labels: row.labels,
          autonomyLevel: row.autonomyLevel,
          trustScore: row.trustScore,
          createdAt: row.createdAt,
          registerTxHash: row.registerTxHash,
          registerBlockNumber: row.registerBlockNumber,
          ibctSigningKeyHex: row.ibctSigningKeyHex,
        })
      }
      for (const row of (idaData.items as EntityAgentRow[]) || []) {
        const did = row.did || ""
        if (!did) continue
        const existing = byDid.get(did)
        byDid.set(did, {
          ...row,
          ...existing,
          entityType: existing?.entityType ?? row.entityType ?? row.labels?.entityType,
          entityId: existing?.entityId ?? row.entityId ?? row.labels?.entityId,
          createdAt: existing?.createdAt ?? row.createdAt,
          registerTxHash: existing?.registerTxHash ?? row.registerTxHash,
        })
      }

      const merged = Array.from(byDid.values()).sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tb - ta
      })
      setAgents(merged)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "List failed")
      setAgents([])
    } finally {
      setBusy(false)
    }
  }, [entityFilter])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  const filterBtn = (value: EntityType, label: string) => (
    <Button
      size="sm"
      variant={entityFilter === value ? "default" : "outline"}
      onClick={() => setEntityFilter(value)}
    >
      {label}
    </Button>
  )

  return (
    <AppShell showWallet={false}>
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entity IDA Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agents created when you <strong>Register on Chain</strong> for citizen,
            clinician, insurer, or provider. All agents use the shared operator DID.
          </p>
        </div>

        {config && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs font-mono space-y-1">
            <div>API: {String(config.apiUrl ?? "—")}</div>
            <div>
              Chain: {String(config.chainId ?? "—")} · signer:{" "}
              {String(config.signerAddress ?? "—")}
            </div>
            <div>
              Operator DID: {String(config.operatorDid ?? "—")}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {filterBtn("", "All")}
          {filterBtn("citizen", "Citizen")}
          {filterBtn("clinician", "Clinician")}
          {filterBtn("insurer", "Insurer")}
          {filterBtn("provider", "Provider")}
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={loadAgents}
          >
            {busy ? "Loading…" : "Refresh"}
          </Button>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">Entity</th>
                <th className="px-3 py-2 text-left">Entity ID</th>
                <th className="px-3 py-2 text-left">Agent name</th>
                <th className="px-3 py-2 text-left">Agent DID</th>
                <th className="px-3 py-2 text-left">Operator DID</th>
                <th className="px-3 py-2 text-left">Trust</th>
                <th className="px-3 py-2 text-left">Autonomy</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {busy && agents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : agents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground">
                    No agents yet. Register an entity on its registry page to create one.
                  </td>
                </tr>
              ) : (
                agents.map((a) => {
                  const did = a.did || a.agentDid || ""
                  const open = expandedDid === did
                  return (
                    <Fragment key={did}>
                      <tr className="border-t align-top">
                        <td className="px-3 py-2 capitalize">
                          {a.entityType || a.labels?.entityType || "—"}
                        </td>
                        <td className="px-3 py-2 font-medium break-all">
                          {a.entityId || a.labels?.entityId || "—"}
                        </td>
                        <td className="px-3 py-2">{a.name || "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs break-all max-w-xs">
                          {did || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs break-all max-w-xs text-muted-foreground">
                          {a.operatorDid || "—"}
                        </td>
                        <td className="px-3 py-2">{a.trustScore ?? "—"}</td>
                        <td className="px-3 py-2">{a.autonomyLevel ?? "—"}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">
                          {a.createdAt
                            ? new Date(a.createdAt).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpandedDid(open ? null : did)}
                          >
                            {open ? "Hide" : "Details"}
                          </Button>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-t bg-muted/20">
                          <td colSpan={9} className="px-3 py-3">
                            <pre className="text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                              {JSON.stringify(a, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
