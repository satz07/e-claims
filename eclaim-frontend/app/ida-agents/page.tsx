"use client"

import { useCallback, useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { eclaimApiHeaders } from "@/lib/eclaim-api"

const base = () =>
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001"

type LastResult = {
  action: string
  ok: boolean
  data?: unknown
  error?: string
}

export default function IdaAgentsPage() {
  const [name, setName] = useState("E-claims Agent")
  const [operatorDid, setOperatorDid] = useState("")
  const [agentDid, setAgentDid] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [last, setLast] = useState<LastResult | null>(null)
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [agents, setAgents] = useState<
    Array<{
      name?: string
      did?: string
      operatorDid?: string
      trustScore?: number
      autonomyLevel?: string | number
    }>
  >([])

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`${base()}/api/public/ida-agents/config`)
      const data = await res.json()
      setConfig(data)
    } catch (e: any) {
      setConfig({ error: e?.message || String(e) })
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  async function call(
    action: string,
    path: string,
    init?: RequestInit,
  ): Promise<any> {
    setBusy(action)
    setLast(null)
    try {
      const res = await fetch(`${base()}${path}`, {
        ...init,
        headers: eclaimApiHeaders(
          (init?.headers as Record<string, string>) || {},
        ),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          data?.message ||
          data?.error ||
          (typeof data === "string" ? data : JSON.stringify(data)) ||
          `HTTP ${res.status}`
        setLast({ action, ok: false, error: Array.isArray(msg) ? msg.join(", ") : String(msg), data })
        return null
      }
      setLast({ action, ok: true, data })
      return data
    } catch (e: any) {
      setLast({ action, ok: false, error: e?.message || String(e) })
      return null
    } finally {
      setBusy(null)
    }
  }

  async function onProvision() {
    const data = await call("provision", "/api/public/ida-agents/provision", {
      method: "POST",
      body: JSON.stringify({
        name,
        operatorDid: operatorDid || undefined,
        platform: "eclaims",
        labels: { app: "eclaims" },
      }),
    })
    if (!data) return
    if (data.operatorDid) setOperatorDid(data.operatorDid)
    if (data.agentDid) setAgentDid(data.agentDid)
  }

  async function onRegister() {
    if (!operatorDid.trim()) {
      setLast({
        action: "register",
        ok: false,
        error: "operatorDid required — provision first or paste one",
      })
      return
    }
    const data = await call("register", "/api/public/ida-agents/register", {
      method: "POST",
      body: JSON.stringify({
        name,
        operatorDid: operatorDid.trim(),
        agentDid: agentDid.trim() || undefined,
      }),
    })
    if (data?.agentDid) setAgentDid(data.agentDid)
  }

  async function onList() {
    const data = await call("list", "/api/public/ida-agents/list?limit=50")
    if (data?.items) setAgents(data.items)
  }

  return (
    <AppShell showWallet={false}>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">IDA Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provision via IDA API, register on-chain with{" "}
            <strong>backend wallet signing</strong> (no MetaMask), and list
            agents — same SDK flows as the playground.
          </p>
        </div>

        {config && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs font-mono space-y-1">
            <div>API: {String(config.apiUrl ?? "—")}</div>
            <div>
              Chain: {String(config.chainId ?? "—")} · signer:{" "}
              {String(config.signerAddress ?? "—")}
            </div>
          </div>
        )}

        <div className="space-y-3 rounded-lg border p-4">
          <label className="block text-sm">
            <span className="text-muted-foreground">Agent name</span>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Operator DID</span>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm font-mono"
              placeholder="auto-minted on Provision if empty"
              value={operatorDid}
              onChange={(e) => setOperatorDid(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Agent DID</span>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm font-mono"
              placeholder="filled after Provision / Register"
              value={agentDid}
              onChange={(e) => setAgentDid(e.target.value)}
            />
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              disabled={!!busy}
              onClick={onProvision}
            >
              {busy === "provision" ? "Provisioning…" : "Provision agent"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!!busy}
              onClick={onRegister}
            >
              {busy === "register" ? "Registering…" : "Register agent"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!!busy}
              onClick={onList}
            >
              {busy === "list" ? "Loading…" : "List agents"}
            </Button>
          </div>
        </div>

        {(operatorDid || agentDid) && (
          <div className="rounded-lg border p-4 space-y-2 text-sm">
            <div className="font-medium">Current IDs</div>
            <div>
              <span className="text-muted-foreground">Operator DID: </span>
              <code className="break-all text-xs">{operatorDid || "—"}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Agent DID: </span>
              <code className="break-all text-xs">{agentDid || "—"}</code>
            </div>
          </div>
        )}

        {last && (
          <div
            className={`rounded-lg border p-4 text-sm ${
              last.ok ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
            }`}
          >
            <div className="font-medium mb-2">
              {last.action} — {last.ok ? "OK" : "Error"}
            </div>
            {last.error && (
              <p className="text-red-700 mb-2">{last.error}</p>
            )}
            {last.data != null && (
              <pre className="text-xs overflow-auto max-h-80 whitespace-pre-wrap">
                {JSON.stringify(last.data, null, 2)}
              </pre>
            )}
          </div>
        )}

        {agents.length > 0 && (
          <div className="rounded-lg border p-4">
            <div className="font-medium mb-3 text-sm">
              Agents ({agents.length})
            </div>
            <ul className="space-y-3 text-sm">
              {agents.map((a, i) => (
                <li key={a.did || i} className="border-b pb-2 last:border-0">
                  <div className="font-medium">{a.name || "(unnamed)"}</div>
                  <div className="text-xs font-mono break-all text-muted-foreground">
                    {a.did}
                  </div>
                  {a.operatorDid && (
                    <div className="text-xs text-muted-foreground">
                      operator: {a.operatorDid}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    trust {a.trustScore ?? "—"} · autonomy{" "}
                    {a.autonomyLevel ?? "—"}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  )
}
