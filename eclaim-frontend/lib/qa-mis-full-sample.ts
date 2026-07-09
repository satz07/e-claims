/** Full institutional QA MIS bundle (diagnosis, attachments, dual coverage, invoice extensions). */
export function buildFullQaMisSample(use: "claim" | "preauthorization"): string {
  const bundleId = crypto.randomUUID()
  const claimId = crypto.randomUUID()

  const bundle = {
    meta: {
      profile: [
        "https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/bundle|1.0.0",
      ],
    },
    timestamp: "2024-12-12T05:52:24Z",
    type: "message",
    resourceType: "Bundle",
    id: bundleId,
    entry: [
      {
        fullUrl: "https://qa-mis.apeiro-digital.com/fhir/Coverage/CR3248022528592-4-sha-coverage",
        resource: {
          id: "CR3248022528592-4-sha-coverage",
          extension: [
            {
              url: "https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/schemeCategoryCode",
              valueString: "CAT-SHA-001",
            },
            {
              url: "https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/schemeCategoryName",
              valueString: "SOCIAL HEALTH AUTHORITY",
            },
          ],
          identifier: [
            { use: "official", value: "CR3248022528592-4-sha-coverage" },
          ],
          status: "active",
          beneficiary: {
            reference: "https://qa-mis.apeiro-digital.com/fhir/Patient/CR3248022528592-4",
            type: "Patient",
          },
          resourceType: "Coverage",
        },
      },
      {
        fullUrl: "https://qa-mis.apeiro-digital.com/fhir/Coverage/CR3248022528592-4-pmf-coverage",
        resource: {
          id: "CR3248022528592-4-pmf-coverage",
          extension: [
            {
              url: "https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/schemeCategoryCode",
              valueString: "CAT-SHA-001",
            },
            {
              url: "https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/schemeCategoryName",
              valueString: "SOCIAL HEALTH AUTHORITY",
            },
          ],
          identifier: [
            { use: "official", value: "CR3248022528592-4-pmf-coverage" },
          ],
          status: "active",
          beneficiary: {
            reference: "https://qa-mis.apeiro-digital.com/fhir/Patient/CR3248022528592-4",
            type: "Patient",
          },
          resourceType: "Coverage",
        },
      },
      {
        fullUrl: "https://qa-mis.apeiro-digital.com/fhir/Organization/FID-35-108719-7",
        resource: {
          identifier: [
            {
              use: "official",
              system: "https://qa-mis.apeiro-digital.com/fhir/license/provider-license",
              value: "PR-FHIR",
            },
          ],
          active: true,
          type: [
            {
              coding: [
                {
                  system: "https://qa-mis.apeiro-digital.com/fhir/terminology/CodeSystem/organization-type",
                  code: "prov",
                },
              ],
            },
          ],
          resourceType: "Organization",
          id: "FID-35-108719-7",
          meta: {
            profile: [
              "https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/provider-organization|1.0.0",
            ],
          },
          name: "ST. LEONARDS HOSPITAL",
          extension: [
            {
              url: "https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/facility-level",
              valueCodeableConcept: {
                coding: [
                  {
                    system: "https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/facility-level",
                    code: "LEVEL 4",
                    display: "LEVEL 4",
                  },
                ],
              },
            },
          ],
        },
      },
      {
        fullUrl: "https://qa-mis.apeiro-digital.com/fhir/Patient/CR3248022528592-4",
        resource: {
          gender: "female",
          birthDate: "1994-05-09",
          resourceType: "Patient",
          id: "CR3248022528592-4",
          meta: {
            profile: [
              "https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/patient|1.0.0",
            ],
          },
          identifier: [
            {
              use: "official",
              system: "https://qa-mis.apeiro-digital.com/fhir/identifier/shanumber",
              value: "CR3248022528592-4",
            },
            {
              value: "254725347404",
              use: "official",
              system: "https://qa-mis.apeiro-digital.com/fhir/identifier/phonenumber",
            },
            {
              use: "official",
              system: "https://qa-mis.apeiro-digital.com/fhir/identifier/nationalid",
              value: "30360528",
            },
            {
              system: "https://qa-mis.apeiro-digital.com/fhir/identifier/other",
              value: "30360528",
              use: "official",
            },
          ],
          name: [
            {
              text: "UASIN GISHU",
              family: "CHEPNGENO",
              given: ["CYNTHIA", "KOECH"],
            },
          ],
        },
      },
      {
        fullUrl: `https://qa-mis.apeiro-digital.com/fhir/Claim/${claimId}`,
        resource: {
          created: "2024-12-03",
          provider: {
            reference: "https://qa-mis.apeiro-digital.com/fhir/Organization/FID-35-108719-7",
          },
          id: claimId,
          status: "active",
          priority: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/processpriority",
                code: "normal",
              },
            ],
          },
          total: { value: 11000, currency: "KES" },
          resourceType: "Claim",
          subType: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/ex-claimsubtype",
                code: "ip",
              },
            ],
          },
          patient: {
            reference: "https://qa-mis.apeiro-digital.com/fhir/Patient/CR3248022528592-4",
          },
          insurance: [
            {
              coverage: {
                reference:
                  "https://qa-mis.apeiro-digital.com/fhir/Coverage/CR3248022528592-4-sha-coverage",
              },
              focal: true,
              sequence: 1,
            },
            {
              coverage: {
                reference:
                  "https://qa-mis.apeiro-digital.com/fhir/Coverage/CR3248022528592-4-pmf-coverage",
              },
              focal: true,
              sequence: 2,
            },
          ],
          billablePeriod: {
            start: "2026-03-27T03:59:22+03:00",
            end: "2026-03-29T17:00:47+03:00",
          },
          diagnosis: [
            {
              sequence: 1,
              diagnosisCodeableConcept: {
                coding: [
                  {
                    code: "BC00",
                    display: "Multiple valve disease",
                    system: "https://qa-mis.apeiro-digital.com/fhir/terminology/CodeSystem/icd-10",
                  },
                ],
              },
            },
          ],
          extension: [
            {
              extension: [
                {
                  url: "invoiceNumber",
                  valueString: "Provider Invoice Number: ICO0061326",
                },
                { valueDate: "2026-03-26", url: "invoiceDate" },
                {
                  url: "invoiceAmount",
                  valueMoney: { value: 2111, currency: "KES" },
                },
                {
                  url: "https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/extension-patient-share",
                  valueMoney: { value: 0, currency: "KES" },
                },
                {
                  url: "https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/extension-patientInvoiceIdentifier",
                  valueIdentifier: {
                    system: "https://qa-mis.apeiro-digital.com/fhir/identifier/patientInvoice",
                    value: "E2YQM6KQKB",
                  },
                },
              ],
              url: "https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/extension-patientInvoice",
            },
          ],
          identifier: [
            {
              system: "https://qa-mis.apeiro-digital.com/fhir/claim",
              value: claimId,
            },
          ],
          type: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/claim-type",
                code: "institutional",
              },
            ],
          },
          supportingInfo: [
            {
              sequence: 1,
              category: {
                coding: [
                  {
                    system: "http://terminology.hl7.org/CodeSystem/claiminformationcategory",
                    code: "attachment",
                    display: "Attachment",
                  },
                ],
              },
              valueAttachment: {
                extension: [
                  {
                    url: "https://fhir.sha.go.ke/fhir/CodeSystem/attachment-type",
                    valueCodeableConcept: {
                      coding: [
                        {
                          system: "https://fhir.sha.go.ke/fhir/CodeSystem/attachment-type",
                          code: "birth-notification",
                          display: "Birth Notification",
                        },
                      ],
                    },
                  },
                ],
                contentType: "application/pdf",
                language: "en",
                url: "https://api-edi.provider.sha.go.ke/media/edi/2026/03/10/6643ea94-9e74-4ec5-aa90-4663327db7f5_9f06076e-ee07-404c-8f1f-e0f9cba332a2_cc89e18e5af0676515523d4ab02a2ba3dbe3ff6889f9f7ffcb19b748141dc7c0.PDF",
                size: 149013,
                title: "notification - christine  notification.pdf",
                creation: "2026-03-10T16:11:10+03:00",
              },
            },
          ],
          use,
          item: [
            {
              productOrService: {
                coding: [
                  {
                    system: "https://qa-mis.apeiro-digital.com/fhir/CodeSystem/intervention-codes",
                    code: "PMF-12-001",
                    display: "pellative care",
                  },
                ],
              },
              servicedPeriod: { start: "2026-03-27", end: "2026-03-29" },
              quantity: { value: 1 },
              unitPrice: { value: 11000, currency: "KES" },
              factor: 1,
              net: { value: 11000, currency: "KES" },
              sequence: 1,
            },
          ],
        },
      },
    ],
  }

  return JSON.stringify(bundle, null, 2)
}
