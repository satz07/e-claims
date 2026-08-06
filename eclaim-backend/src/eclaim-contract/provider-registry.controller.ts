import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ProviderRegistryService } from './provider-registry.service';
import { EclaimApiKeyGuard } from './eclaim-api-key.guard';

@ApiTags('[E-CLAIM-Only] provider-registry')
@ApiSecurity('eclaim-api-key')
@ApiHeader({ name: 'X-API-Key', required: true, description: 'E-claim integration API key' })
@UseGuards(EclaimApiKeyGuard)
@Controller('public/provider-registry')
export class ProviderRegistryController {
  constructor(private readonly service: ProviderRegistryService) {}

  @Get()
  async listProviders(
    @Query('page') page = '0',
    @Query('size') size = '50',
  ) {
    return this.service.getAllProviders(Number(page), Number(size));
  }

  @Post('remember')
  async rememberProvider(@Body() body: { providerId: string }) {
    return this.service.rememberPlainId(body.providerId);
  }

  @Post('search')
  async searchProvider(@Body() body: { providerId: string }) {
    return this.service.getProvider(body.providerId);
  }

  @Post('register')
  async registerProvider(
    @Body()
    body: {
      providerId: string;
      name: string;
      level: string;
      county: string;
      facilityType: string;
      licenseValidFrom: string;
      licenseValidTo: string;
    },
  ) {
    return this.service.registerProvider(body);
  }

  @Get(':providerId/history')
  async getHistory(@Param('providerId') providerId: string) {
    return this.service.getProviderHistory(providerId);
  }

  @Get(':providerId')
  async getProvider(@Param('providerId') providerId: string) {
    return this.service.getProvider(providerId);
  }

  @Post(':providerId/deregister')
  async deregister(@Param('providerId') providerId: string) {
    return this.service.deregisterProvider(providerId);
  }

  @Post(':providerId/suspend')
  async suspend(@Param('providerId') providerId: string) {
    return this.service.suspendProvider(providerId);
  }

  @Post(':providerId/reactivate')
  async reactivate(@Param('providerId') providerId: string) {
    return this.service.reactivateProvider(providerId);
  }

  @Post(':providerId/license')
  async updateLicense(
    @Param('providerId') providerId: string,
    @Body() body: { licenseValidFrom: string; licenseValidTo: string },
  ) {
    return this.service.updateLicense(
      providerId,
      body.licenseValidFrom,
      body.licenseValidTo,
    );
  }

  @Post(':providerId/tier')
  async setTier(
    @Param('providerId') providerId: string,
    @Body() body: { level: string },
  ) {
    return this.service.setProviderTier(providerId, body.level);
  }
}
