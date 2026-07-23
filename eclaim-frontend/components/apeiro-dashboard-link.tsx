import { ExternalLink } from "lucide-react"

const APEIRO_DASHBOARD_URL =
  "https://apeiro-operations-dashboard.ma0101461427.chatgpt.site/"

export function ApeiroDashboardLink() {
  return (
    <a
      href={APEIRO_DASHBOARD_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-700 backdrop-blur-sm transition-colors hover:bg-emerald-500/20 hover:border-emerald-500/60 md:text-sm"
    >
      Apeiro Dashboard
      <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
    </a>
  )
}
