import { Controller, Post, Get, Body, Param, Query, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EclaimContractService } from './eclaim-contract.service';

@ApiTags('[E-CLAIM-Only]  eclaim-contract')
@Controller('public/eclaim-contract')
export class EclaimContractController {
  constructor(private readonly service: EclaimContractService) {}

  /** Anchor a FHIR R4 Bundle (Claim.use = claim | preauthorization). Backend signs chain tx. */
  @Post('submit')
  @HttpCode(201)
  async submitFhir(@Body() body: Record<string, unknown>) {
    return this.service.submitFhirBundle(body);
  }

  @Get()
  async getAllClaims(
    @Query('page') page = '0',
    @Query('size') size = '20',
    @Query('recordUse') recordUse?: 'claim' | 'preauthorization',
  ) {
    return this.service.getAllClaims(Number(page), Number(size), recordUse);
  }

  /** Cache plaintext form data submitted after MetaMask upsertClaim succeeds */
  @Post('meta')
  @HttpCode(200)
  async cacheMeta(@Body() body: {
    claimNumber: number;
    claimId: string;
    claimType: string;
    recordUse?: 'claim' | 'preauthorization';
    fid?: string;
    patientName?: string;
    providerName?: string;
    shaCode?: string;
    claimedTotal: string;
  }) {
    this.service.cacheClaimMeta(Number(body.claimNumber), {
      claimId: body.claimId,
      recordUse: body.recordUse ?? 'claim',
      claimType: body.claimType,
      fid: body.fid ?? body.providerName ?? '',
      patientName: body.patientName || '',
      providerName: body.providerName || '',
      shaCode: body.shaCode || '',
      claimedTotal: body.claimedTotal || '0',
      creationDate: new Date().toLocaleDateString('en-US'),
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
