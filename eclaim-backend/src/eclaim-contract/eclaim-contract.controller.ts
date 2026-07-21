import { Controller, Post, Get, Body, Param, Query, HttpCode, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EclaimContractService } from './eclaim-contract.service';

@ApiTags('[E-CLAIM-Only]  eclaim-contract')
@Controller('public/eclaim-contract')
export class EclaimContractController {
  constructor(private readonly service: EclaimContractService) {}

  /** Validate FHIR + return claim struct for MetaMask signing (user pays gas). */
  @Post('prepare-submit')
  @HttpCode(200)
  async prepareSubmit(@Body() body: Record<string, unknown>) {
    return this.service.prepareFhirSubmit(body);
  }

  /** Anchor a FHIR R4 Bundle (Claim.use = claim | preauthorization). Backend signs chain tx. */
  @Post('submit')
  @HttpCode(201)
  async submitFhir(
    @Body() body: Record<string, unknown>,
    @Query('wait') wait?: string,
  ) {
    return this.service.submitFhirBundle(body, { wait: wait !== 'false' });
  }

  @Get()
  async getAllClaims(
    @Query('page') page = '0',
    @Query('size') size = '20',
    @Query('recordUse') recordUse?: 'claim' | 'preauthorization',
  ) {
    return this.service.getAllClaims(Number(page), Number(size), recordUse);
  }

  /** Cache FHIR metadata after client-side MetaMask upsertClaim succeeds */
  @Post('meta')
  @HttpCode(200)
  async cacheMeta(@Body() body: {
    claimNumber: number;
    source?: 'fhir' | 'demo';
    claimId: string;
    claimType: string;
    recordUse?: 'claim' | 'preauthorization';
    fid?: string;
    crId?: string;
    schemeCode?: string;
    facilityLevel?: string;
    interventionCode?: string;
    bundleId?: string;
    ipsClaim?: boolean;
    claimedTotal: string;
    creationDate?: string;
    patientName?: string;
    providerName?: string;
    shaCode?: string;
  }) {
    if (body.source === 'demo' || body.patientName || body.shaCode) {
      throw new BadRequestException('Demo claim metadata is no longer accepted');
    }
    this.service.cacheClaimMeta(Number(body.claimNumber), {
      source: 'fhir',
      claimId: body.claimId,
      recordUse: body.recordUse ?? 'claim',
      claimType: body.claimType,
      fid: body.fid ?? '',
      crId: body.crId,
      schemeCode: body.schemeCode,
      facilityLevel: body.facilityLevel,
      interventionCode: body.interventionCode,
      bundleId: body.bundleId,
      ipsClaim: body.ipsClaim,
      claimedTotal: body.claimedTotal || '0',
      creationDate: body.creationDate || new Date().toISOString().slice(0, 10),
    });
    return { ok: true };
  }

  /** Search by claimId string (hashed internally) */
  @Post('search')
  async searchClaim(@Body() body: { claimId: string; claimType?: string }) {
    return this.service.getClaimByClaimId(body.claimId);
  }

  @Post('check-duplicate')
  async checkDuplicate(@Body() body: { claimId: string; fileType?: string }) {
    return this.service.checkDuplicate(body.claimId, body.fileType || '');
  }

  /** Deployment + on-chain vs off-chain field guide (no secrets). */
  @Get('info')
  async getInfo() {
    return this.service.getDeploymentInfo();
  }

  /** Get by on-chain claimNumber */
  @Get(':claimNumber')
  async getClaim(@Param('claimNumber') claimNumber: string) {
    return this.service.getClaim(Number(claimNumber));
  }

  /** Update status (requires backend wallet = owner) */
  @Post(':claimNumber/status')
  async setStatus(
    @Param('claimNumber') claimNumber: string,
    @Body() body: { status: number },
  ) {
    return this.service.setClaimStatus(Number(claimNumber), body.status);
  }
}
