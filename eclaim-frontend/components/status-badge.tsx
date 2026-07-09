import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
}
const STATUS_STYLES: Record<string, string> = {
  "approved": "bg-green-500/10 text-green-600",
  "partial-approval": "bg-green-500/10 text-green-600",

  "pending": "bg-yellow-500/10 text-yellow-600",
  "queued": "bg-yellow-500/10 text-yellow-600",
  "submitted": "bg-yellow-500/10 text-yellow-600",

  "in-review": "bg-blue-500/10 text-blue-600",
  "clinical-review": "bg-purple-500/10 text-purple-600",
  "medical-review": "bg-purple-500/10 text-purple-600",
  "under-committee-review": "bg-purple-500/10 text-purple-600",

  "sent-back": "bg-orange-500/10 text-orange-600",
  "clarification-after-payer-checks": "bg-orange-500/10 text-orange-600",

  "sent-to-surveillance": "bg-indigo-500/10 text-indigo-600",

  "sent-for-payment-processing": "bg-blue-500/10 text-blue-600",

  "payment-completed": "bg-green-500/10 text-green-600",
  "payment-partial": "bg-yellow-500/10 text-yellow-600",
  "payment-declined": "bg-red-500/10 text-red-600",

  "rejected": "bg-red-500/10 text-red-600",
  "canceled": "bg-gray-500/10 text-gray-600",
  "unknown": "bg-gray-500/10 text-gray-600",
}


const normalizeStatus = (status: string) =>
  status.toLowerCase().replace(/[_\s]+/g, "-").trim()

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = normalizeStatus(status)
  const style = STATUS_STYLES[normalized] ?? "bg-gray-500/10 text-gray-600"

  return (
    <span
      className={cn(
        "inline-block px-3 py-1 rounded text-xs font-medium truncate",
        style
      )}
    >
      {status}
    </span>
  )
}
