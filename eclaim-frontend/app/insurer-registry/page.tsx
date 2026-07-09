import { HashRegistryPage } from "@/components/hash-registry-page"

export default function InsurerRegistryPage() {
  return (
    <HashRegistryPage
      config={{
        kind: "insurer",
        title: "Insurer / scheme registry",
        idLabel: "Scheme or insurer code",
        idPlaceholder: "CAT-SHA-001",
        description:
          "Verifiable insurance scheme reference from FHIR Coverage. Scheme code is hashed — benefit package details stay off-chain.",
      }}
    />
  )
}
