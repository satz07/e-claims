import {
  Body,
  Controller,
  Get,
  HttpCode,
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

  @Get('list')
  list(
    @Query('limit') limit?: string,
    @Query('labels') labelsJson?: string,
  ) {
    let labels: Record<string, string> | undefined;
    if (labelsJson) {
      try {
        labels = JSON.parse(labelsJson);
      } catch {
        labels = undefined;
      }
    }
    return this.service.listAgents({
      limit: limit ? Number(limit) : 50,
      labels,
    });
  }
}
