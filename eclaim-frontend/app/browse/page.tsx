import { ClaimsSearch } from "@/components/claims-search"

export default function BrowseClaimsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Browse anchored claims</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Read-only view of claims anchored on Spearhead. No wallet required.
        </p>
      </div>
      <ClaimsSearch />
    </div>
  )
}
