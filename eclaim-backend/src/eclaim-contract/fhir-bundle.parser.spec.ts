import { parseFhirBundle, buildClaimStruct, hashUtf8 } from './fhir-bundle.parser';

const sampleBundle = {
  resourceType: 'Bundle',
  id: '32b8cef8-9bc6-4402-8556-856f42ebc028',
  type: 'message',
  entry: [
    {
      resource: {
        resourceType: 'Organization',
        id: 'FID-35-108719-7',
        name: 'ST. LEONARDS HOSPITAL',
        extension: [
          {
            url: 'https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/facility-level',
            valueCodeableConcept: { coding: [{ code: 'LEVEL 4' }] },
          },
        ],
      },
    },
    {
      resource: {
        resourceType: 'Coverage',
        extension: [{ url: 'schemeCategoryCode', valueString: 'CAT-SHA-001' }],
      },
    },
    {
      resource: {
        resourceType: 'Patient',
        id: 'CR3248022528592-4',
        identifier: [{ system: 'nationalid', value: '30360528' }],
      },
    },
    {
      resource: {
        resourceType: 'Claim',
        use: 'claim',
        identifier: [
          {
            system: 'https://qa-mis.apeiro-digital.com/fhir/claim',
            value: 'a8ce4901-a9d4-419c-abea-182ad42992ab',
          },
        ],
        type: { coding: [{ code: 'institutional' }] },
        subType: { coding: [{ code: 'ip' }] },
        total: { value: 11000, currency: 'KES' },
        billablePeriod: {
          start: '2026-03-27T03:59:22+03:00',
          end: '2026-03-29T17:00:47+03:00',
        },
        created: '2024-12-03',
        provider: { reference: 'Organization/FID-35-108719-7' },
        patient: { reference: 'Patient/CR3248022528592-4' },
        item: [
          {
            productOrService: {
              coding: [{ code: 'PMF-12-001', display: 'palliative care' }],
            },
          },
        ],
      },
    },
  ],
};

describe('parseFhirBundle (QA MIS profile)', () => {
  it('parses institutional ip claim bundle', () => {
    const p = parseFhirBundle(sampleBundle);
    expect(p.bundleId).toBe('32b8cef8-9bc6-4402-8556-856f42ebc028');
    expect(p.claimId).toBe('a8ce4901-a9d4-419c-abea-182ad42992ab');
    expect(p.recordUse).toBe('claim');
    expect(p.fid).toBe('FID-35-108719-7');
    expect(p.facilityLevel).toBe('LEVEL 4');
    expect(p.schemeCode).toBe('CAT-SHA-001');
    expect(p.crId).toBe('CR3248022528592-4');
    expect(p.nationalId).toBe('30360528');
    expect(p.claimedTotal).toBe(11000n);
    expect(p.ipsClaim).toBe(true);
    expect(p.interventionCode).toBe('PMF-12-001');
    expect(p.bundleContentHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('builds minimal Claim struct for contract', () => {
    const p = parseFhirBundle(sampleBundle);
    const struct = buildClaimStruct(p, 1n);
    expect(struct.fidHash).toBe(hashUtf8('FID-35-108719-7'));
    expect(struct.recordUseHash).toBe(hashUtf8('claim'));
    expect(struct.bundleContentHash).toBe(p.bundleContentHash);
    expect(struct.interventionCodeHash).toBe(hashUtf8('PMF-12-001'));
  });

  it('parses preauthorization via Claim.use only', () => {
    const preAuth = JSON.parse(JSON.stringify(sampleBundle));
    preAuth.entry[3].resource.use = 'preauthorization';
    preAuth.entry[3].resource.identifier[0].value = 'preauth-uuid-001';
    const p = parseFhirBundle(preAuth);
    expect(p.recordUse).toBe('preauthorization');
    expect(buildClaimStruct(p, 2n).recordUseHash).toBe(hashUtf8('preauthorization'));
  });
});
