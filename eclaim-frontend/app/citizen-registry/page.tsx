import { HashRegistryPage } from "@/components/hash-registry-page"

export default function CitizenRegistryPage() {
  return (
    <HashRegistryPage
      config={{
        kind: "citizen",
        title: "Citizen registry",
        idLabel: "Citizen CR ID",
        idPlaceholder: "CR3248022528592-4",
        description:
          "Verifiable beneficiary reference for E-claims. Stores keccak256(CR id) and enrollment validity — not patient name or demographics.",
      }}
    />
  )
}
