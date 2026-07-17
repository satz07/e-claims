"use client"

import { useCallback, useEffect, useState } from "react"
import { useWriteContract, useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { hashUtf8, toUnix } from "@/lib/onchain-hash"
import {
  VERIFIABLE_REGISTRY_ABI,
  VERIFIABLE_REGISTRY_ADDRESSES,
} from "@/lib/registry-contracts"
import {
  PROVIDER_REGISTRY_ABI,
  PROVIDER_REGISTRY_ADDRESS,
} from "@/lib/provider-contracts"
import { writeContractAndWait } from "@/lib/write-contract"
import { explorerTxUrl } from "@/lib/network"

type Tab = "register" | "lookup" | "list"
export type RegistryKind = "citizen" | "clinician" | "insurer" | "provider"

type RegistryConfig = {
  kind: RegistryKind
  title: string
  description: string
  idLabel: string
  idPlaceholder: string
  metaLabel?: string
  metaPlaceholder?: string
}

const FACILITY_TYPES = [
  { value: "hospital", label: "Hospital" },
  { value: "clinic", label: "Clinic" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "laboratory", label: "Laboratory" },
]

const base = () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001"

function apiPath(kind: RegistryKind) {
  return kind === "provider"
    ? `${base()}/api/public/provider-registry`
    : `${base()}/api/public/${kind}-registry`
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | boolean | null | undefined }) {
  const display = typeof value === "boolean" ? (value ? "Yes" : "No") : value ?? "—"
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium break-all">{String(display)}</p>
    </div>
  )
}

function SuccessBanner({ message, txHash }: { message: string; txHash?: string }) {
  return (
    <div className="rounded-md border border-green-800 bg-green-950/30 p-3 text-sm space-y-2">
      <p className="text-green-600">{message}</p>
      {txHash && (
        <p className="break-all text-xs text-muted-foreground">
          <strong>tx:</strong> {txHash}
        </p>
      )}
      {txHash && (
        <Button variant="outline" size="sm" asChild>
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on explorer
          </a>
        </Button>
      )}
    </div>
  )
}

export function HashRegistryPage({ config }: { config: RegistryConfig }) {
  const api = apiPath(config.kind)
  const { isConnected, address } = useAccount()
  const { writeContractAsync, isPending: isTxPending } = useWriteContract()
  const [tab, setTab] = useState<Tab>("register")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ message: string; txHash?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const [simpleForm, setSimpleForm] = useState({
    id: "",
    meta: "",
    validFrom: "2024-01-01",
    validTo: "2030-12-31",
  })

  const [providerForm, setProviderForm] = useState({
    providerId: "",
    name: "",
    level: "LEVEL 4",
    county: "NAIROBI",
    facilityType: "hospital",
    licenseValidFrom: "2024-01-01",
    licenseValidTo: "2030-12-31",
  })

  const [lookupId, setLookupId] = useState("")
  const [lookupResult, setLookupResult] = useState<Record<string, unknown> | null>(null)
  const [listRows, setListRows] = useState<Record<string, unknown>[]>([])
  const [listConfigured, setListConfigured] = useState(true)

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(api)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "List failed")
      if (config.kind === "provider") {
        setListRows((data.providers as Record<string, unknown>[]) || [])
        setListConfigured(true)
      } else {
        setListRows((data.entries as Record<string, unknown>[]) || [])
        setListConfigured(data.configured !== false)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "List failed")
    } finally {
      setLoading(false)
    }
  }, [api, config.kind])

  useEffect(() => {
    if (tab === "list") fetchList()
  }, [tab, fetchList])

  const register = async () => {
    if (!isConnected) {
      setError("Connect MetaMask first — your wallet signs and pays gas.")
      return
    }
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      let txHash: string

      if (config.kind === "provider") {
        txHash = await writeContractAndWait(writeContractAsync, {
          address: PROVIDER_REGISTRY_ADDRESS,
          abi: PROVIDER_REGISTRY_ABI,
          functionName: "registerProvider",
          args: [
            hashUtf8(providerForm.providerId),
            hashUtf8(providerForm.name),
            hashUtf8(providerForm.level),
            hashUtf8(providerForm.county),
            hashUtf8(providerForm.facilityType),
            toUnix(providerForm.licenseValidFrom),
            toUnix(providerForm.licenseValidTo),
          ],
        }, address)
      } else {
        const registryAddress = VERIFIABLE_REGISTRY_ADDRESSES[config.kind]
        txHash = await writeContractAndWait(writeContractAsync, {
          address: registryAddress,
          abi: VERIFIABLE_REGISTRY_ABI,
          functionName: "register",
          args: [
            hashUtf8(simpleForm.id),
            hashUtf8(simpleForm.meta || ""),
            toUnix(simpleForm.validFrom),
            toUnix(simpleForm.validTo),
          ],
        }, address)
      }

      const id =
        config.kind === "provider" ? providerForm.providerId : simpleForm.id
      setSuccess({
        message: `Registered ${id} (signed with your wallet).`,
        txHash,
      })
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      setError(err?.shortMessage || err?.message || "Register failed — confirm in MetaMask")
    } finally {
      setLoading(false)
    }
  }

  const lookup = async () => {
    setError(null)
    setLookupResult(null)
    setLoading(true)
    try {
      const searchBody =
        config.kind === "provider"
          ? { providerId: lookupId }
          : { id: lookupId }

      const res = await fetch(`${api}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchBody),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Not found")
      setLookupResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lookup failed")
    } finally {
      setLoading(false)
    }
  }

  const tabBtn = (t: Tab, label: string) => (
    <Button variant={tab === t ? "default" : "outline"} size="sm" onClick={() => setTab(t)}>
      {label}
    </Button>
  )

  const listIdKey = config.kind === "provider" ? "providerId" : "id"

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{config.title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{config.description}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Only <strong>hashed IDs</strong> and validity dates are stored on-chain — no names or PHI.
          <strong> MetaMask required</strong> — your wallet signs and pays gas (same as Issue Claim).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabBtn("register", "Register")}
        {tabBtn("lookup", "Lookup")}
        {tabBtn("list", "List")}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {success && <SuccessBanner message={success.message} txHash={success.txHash} />}

      {tab === "register" && config.kind !== "provider" && (
        <div className="grid gap-4 md:grid-cols-2 border rounded-lg p-4 bg-card">
          <FormField label={config.idLabel}>
            <Input
              value={simpleForm.id}
              onChange={(e) => setSimpleForm({ ...simpleForm, id: e.target.value })}
              placeholder={config.idPlaceholder}
            />
          </FormField>
          {config.metaLabel && (
            <FormField label={config.metaLabel}>
              <Input
                value={simpleForm.meta}
                onChange={(e) => setSimpleForm({ ...simpleForm, meta: e.target.value })}
                placeholder={config.metaPlaceholder}
              />
            </FormField>
          )}
          <FormField label="Valid from">
            <Input
              type="date"
              value={simpleForm.validFrom}
              onChange={(e) => setSimpleForm({ ...simpleForm, validFrom: e.target.value })}
            />
          </FormField>
          <FormField label="Valid to">
            <Input
              type="date"
              value={simpleForm.validTo}
              onChange={(e) => setSimpleForm({ ...simpleForm, validTo: e.target.value })}
            />
          </FormField>
          <div className="md:col-span-2">
            <Button
              onClick={register}
              disabled={loading || isTxPending || !simpleForm.id}
            >
              {loading || isTxPending
                ? isTxPending
                  ? "Confirm in MetaMask…"
                  : "Waiting for confirmation…"
                : "Register on Chain"}
            </Button>
          </div>
        </div>
      )}

      {tab === "register" && config.kind === "provider" && (
        <div className="grid gap-4 md:grid-cols-2 border rounded-lg p-4 bg-card">
          <FormField label="Facility ID (FID)">
            <Input
              value={providerForm.providerId}
              onChange={(e) => setProviderForm({ ...providerForm, providerId: e.target.value })}
              placeholder="FID-35-108719-7"
            />
          </FormField>
          <FormField label="Facility name (hashed on-chain)">
            <Input
              value={providerForm.name}
              onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
              placeholder="ST. LEONARDS HOSPITAL"
            />
          </FormField>
          <FormField label="Level">
            <Input
              value={providerForm.level}
              onChange={(e) => setProviderForm({ ...providerForm, level: e.target.value })}
              placeholder="LEVEL 4"
            />
          </FormField>
          <FormField label="County (hashed)">
            <Input
              value={providerForm.county}
              onChange={(e) => setProviderForm({ ...providerForm, county: e.target.value })}
            />
          </FormField>
          <FormField label="Facility type">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={providerForm.facilityType}
              onChange={(e) => setProviderForm({ ...providerForm, facilityType: e.target.value })}
            >
              {FACILITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="License valid from">
            <Input
              type="date"
              value={providerForm.licenseValidFrom}
              onChange={(e) =>
                setProviderForm({ ...providerForm, licenseValidFrom: e.target.value })
              }
            />
          </FormField>
          <FormField label="License valid to">
            <Input
              type="date"
              value={providerForm.licenseValidTo}
              onChange={(e) =>
                setProviderForm({ ...providerForm, licenseValidTo: e.target.value })
              }
            />
          </FormField>
          <div className="md:col-span-2">
            <Button
              onClick={register}
              disabled={
                loading ||
                isTxPending ||
                !providerForm.providerId ||
                !providerForm.name ||
                !providerForm.licenseValidFrom ||
                !providerForm.licenseValidTo
              }
            >
              {loading || isTxPending
                ? isTxPending
                  ? "Confirm in MetaMask…"
                  : "Waiting for confirmation…"
                : "Register on Chain"}
            </Button>
          </div>
        </div>
      )}

      {tab === "lookup" && (
        <div className="space-y-4 border rounded-lg p-4 bg-card">
          <FormField label={config.idLabel}>
            <Input value={lookupId} onChange={(e) => setLookupId(e.target.value)} />
          </FormField>
          <Button onClick={lookup} disabled={loading || !lookupId}>
            Lookup
          </Button>
          {lookupResult && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Detail
                label="ID"
                value={String(lookupResult[listIdKey] ?? lookupResult.id ?? "—")}
              />
              <Detail label="Status" value={String(lookupResult.status)} />
              <Detail label="Authorized now" value={lookupResult.authorized as boolean} />
              {config.kind === "provider" ? (
                <>
                  <Detail label="Level" value={String(lookupResult.level)} />
                  <Detail label="Facility type" value={String(lookupResult.facilityType)} />
                  <Detail label="License to" value={String(lookupResult.licenseValidTo)} />
                </>
              ) : (
                <>
                  <Detail label="Valid from" value={String(lookupResult.validFrom)} />
                  <Detail label="Valid to" value={String(lookupResult.validTo)} />
                  <Detail label="ID hash" value={String(lookupResult.idHash)} />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "list" && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Authorized</th>
                <th className="px-3 py-2 text-left">
                  {config.kind === "provider" ? "License to" : "Valid to"}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : listRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    {!listConfigured ? "Registry not configured on backend" : "No entries yet"}
                  </td>
                </tr>
              ) : (
                listRows.map((row) => (
                  <tr key={String(row.idHash ?? row.providerIdHash)} className="border-t">
                    <td className="px-3 py-2">{String(row[listIdKey] ?? row.id)}</td>
                    <td className="px-3 py-2">{String(row.status)}</td>
                    <td className="px-3 py-2">{row.authorized ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">
                      {String(row.validTo ?? row.licenseValidTo ?? "—")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
