import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { EclaimApiKeyGuard } from '../eclaim-contract/eclaim-api-key.guard';
import { SkipEclaimApiKey } from '../eclaim-contract/skip-eclaim-api-key.decorator';
import { IdaAgentsService } from './ida-agents.service';

@ApiTags('[E-CLAIM] IDA agents')
@ApiSecurity('eclaim-api-key')
@ApiHeader({
  name: 'X-API-Key',
  required: true,
  description: 'E-claim integration API key',
})
@UseGuards(EclaimApiKeyGuard)
@Controller('public/ida-agents')
export class IdaAgentsController {
  constructor(private readonly service: IdaAgentsService) {}

  @SkipEclaimApiKey()
  @Get('config')
  config() {
    return this.service.getConfigSummary();
  }

  @Post('create-operator-did')
  @HttpCode(200)
  createOperatorDid() {
    return this.service.createOperatorDid();
  }

  @Post('provision')
  @HttpCode(200)
  provision(
    @Body()
    body: {
      name?: string;
      operatorDid?: string;
      sponsorDid?: string;
      platform?: string;
      autonomyLevel?: number;
      labels?: Record<string, string>;
    },
  ) {
    return this.service.provisionAgent(body || {});
  }

  /** On-chain registerAgent — signed by backend wallet (not MetaMask). */
  @Post('register')
  @HttpCode(200)
  register(
    @Body()
    body: {
      operatorDid: string;
      agentDid?: string;
      name?: string;
    },
  ) {
    return this.service.registerAgent(body);
  }

  /** Provision via IDA API + on-chain registerAgent in one call. */
  @Post('provision-and-register')
  @HttpCode(200)
  provisionAndRegister(
    @Body()
    body: {
      name?: string;
      entityType?: 'citizen' | 'clinician' | 'insurer' | 'provider';
      entityId?: string;
      operatorDid?: string;
      platform?: string;
      autonomyLevel?: number;
      labels?: Record<string, string>;
    },
  ) {
    return this.service.provisionAndRegister(body || {});
  }

  @Get('list')
  list(
    @Query('limit') limit?: string,
    @Query('labels') labelsJson?: string,
    @Query('entityType') entityType?: string,
  ) {
    let labels: Record<string, string> | undefined;
    if (labelsJson) {
      try {
        labels = JSON.parse(labelsJson);
      } catch {
        labels = undefined;
      }
    }
    const et = ['citizen', 'clinician', 'insurer', 'provider'].includes(
      entityType || '',
    )
      ? (entityType as 'citizen' | 'clinician' | 'insurer' | 'provider')
      : undefined;
    return this.service.listAgents({
      limit: limit ? Number(limit) : 200,
      labels,
      entityType: et,
    });
  }

  @Get('entities')
  listEntities(@Query('entityType') entityType?: string) {
    const et = ['citizen', 'clinician', 'insurer', 'provider'].includes(
      entityType || '',
    )
      ? (entityType as 'citizen' | 'clinician' | 'insurer' | 'provider')
      : undefined;
    return this.service.listEntityAgents(et);
  }

  @Get('entities/:entityType/:entityId')
  getEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    const et = ['citizen', 'clinician', 'insurer', 'provider'].includes(
      entityType,
    )
      ? (entityType as 'citizen' | 'clinician' | 'insurer' | 'provider')
      : null;
    if (!et) {
      return { found: false, entityType, entityId };
    }
    return this.service.getEntityAgent(et, entityId);
  }
}
