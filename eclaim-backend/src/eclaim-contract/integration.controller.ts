import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IntegrationService } from './integration.service';
import { RegistryEnsureService } from './registry-ensure.service';
import { EclaimApiKeyGuard } from './eclaim-api-key.guard';
import { SkipEclaimApiKey } from './skip-eclaim-api-key.decorator';

@ApiTags('[E-CLAIM] integration')
@ApiSecurity('eclaim-api-key')
@ApiHeader({ name: 'X-API-Key', required: true, description: 'E-claim integration API key' })
@UseGuards(EclaimApiKeyGuard)
@Controller('public/integration')
export class IntegrationController {
  constructor(
    private readonly service: IntegrationService,
    private readonly registryEnsure: RegistryEnsureService,
  ) {}

  @SkipEclaimApiKey()
  @Get('health')
  health() {
    return this.service.getHealth();
  }

  /**
   * Ensure provider / citizen / scheme are on-chain before submit.
   * Body: FHIR Bundle (root) or { bundle } or { fid, crId, schemeCode }.
   * Missing on-chain entries are enriched from CLAIM_DB_* Postgres when configured.
   */
  @Post('ensure-registries')
  @HttpCode(200)
  ensureRegistries(@Body() body: Record<string, unknown>) {
    return this.registryEnsure.ensure(body);
  }

  @Post('seed-demo-registries')
  seedDemoRegistries() {
    return this.service.seedDemoRegistries();
  }

  /** 5 of each registry + 5 claims & 5 preauths per provider (50 anchors). */
  @Post('seed-bulk-demo')
  seedBulkDemo() {
    return this.service.seedBulkDemo();
  }

  /** Extra random claim/preauth anchors (default 45). Uses existing demo facilities. */
  @Post('seed-random-claims')
  seedRandomClaims(@Query('count') count?: string) {
    return this.service.seedRandomAnchors(count ? Number(count) : 45);
  }
}
