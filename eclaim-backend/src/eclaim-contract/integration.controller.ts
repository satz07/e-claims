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
}
