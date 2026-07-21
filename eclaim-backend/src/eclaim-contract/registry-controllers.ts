import {
  Body,
  Controller,
  Get,
  Injectable,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VerifiableRegistryService } from './verifiable-registry.service';

function registryController(kind: 'citizen' | 'clinician' | 'insurer', tag: string) {
  @ApiTags(tag)
  @Controller(`public/${kind}-registry`)
  @Injectable()
  class RegistryController {
    constructor(public readonly service: VerifiableRegistryService) {}

    @Get()
    list(@Query('page') page = '0', @Query('size') size = '50') {
      return this.service.list(kind, Number(page), Number(size));
    }

    @Post('remember')
    remember(@Body() body: { id: string }) {
      return this.service.rememberPlainId(kind, body.id);
    }

    @Post('search')
    search(@Body() body: { id: string }) {
      return this.service.getEntry(kind, body.id);
    }

    @Get(':id')
    get(@Param('id') id: string) {
      return this.service.getEntry(kind, id);
    }

    @Post('register')
    register(
      @Body()
      body: { id: string; meta?: string; validFrom: string; validTo: string },
    ) {
      return this.service.register(kind, body);
    }

    @Post(':id/suspend')
    suspend(@Param('id') id: string) {
      return this.service.suspend(kind, id);
    }

    @Post(':id/reactivate')
    reactivate(@Param('id') id: string) {
      return this.service.reactivate(kind, id);
    }

    @Post(':id/deregister')
    deregister(@Param('id') id: string) {
      return this.service.deregister(kind, id);
    }
  }

  return RegistryController;
}

export const CitizenRegistryController = registryController(
  'citizen',
  '[E-CLAIM] citizen-registry',
);
export const ClinicianRegistryController = registryController(
  'clinician',
  '[E-CLAIM] clinician-registry',
);
export const InsurerRegistryController = registryController(
  'insurer',
  '[E-CLAIM] insurer-registry',
);
