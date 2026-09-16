import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EclaimApiKeyGuard } from '../eclaim-contract/eclaim-api-key.guard';
import { IdaAgentsController } from './ida-agents.controller';
import { IdaAgentsService } from './ida-agents.service';

@Module({
  imports: [ConfigModule],
  controllers: [IdaAgentsController],
  providers: [IdaAgentsService, EclaimApiKeyGuard],
  exports: [IdaAgentsService],
})
export class IdaAgentsModule {}
