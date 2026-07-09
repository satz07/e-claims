import { HashRegistryPage } from "@/components/hash-registry-page"

export default function ProviderRegistryPage() {
  return (
    <HashRegistryPage
      config={{
        kind: "provider",
        title: "Provider / facility registry",
        idLabel: "Facility ID (FID)",
        idPlaceholder: "FID-35-108719-7",
        description:
          "Hospitals and facilities authorized to submit E-claims. Facility id, name, level, and county are stored as hashes on-chain.",
      }}
    />
  )
}
