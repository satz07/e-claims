import { HashRegistryPage } from "@/components/hash-registry-page"

export default function ClinicianRegistryPage() {
  return (
    <HashRegistryPage
      config={{
        kind: "clinician",
        title: "Clinician registry",
        idLabel: "Practitioner / license ID",
        idPlaceholder: "CMP-DEMO-001",
        metaLabel: "Facility FID (hashed as meta)",
        metaPlaceholder: "FID-35-108719-7",
        description:
          "Verifiable clinician license reference. Practitioner id and linked facility FID are hashed on-chain only.",
      }}
    />
  )
}
