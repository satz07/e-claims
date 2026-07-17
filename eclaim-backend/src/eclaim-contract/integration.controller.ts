import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IntegrationService } from './integration.service';

@ApiTags('[E-CLAIM] integration')
@Controller('public/integration')
export class IntegrationController {
  constructor(private readonly service: IntegrationService) {}

  @Get('health')
  health() {
    return this.service.getHealth();
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
}
