import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DonationsService } from './donations.service';
import { ListDonationsQueryDto } from './dto/donations.dto';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Donations')
@ApiBearerAuth('access-token')
@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @UseGuards(RolesGuard)
  @Get()
  @ApiOperation({ summary: 'Get paginated donations with filters' })
  findAll(@Query() query: ListDonationsQueryDto) {
    return this.donationsService.findAll(query);
  }

  @UseGuards(RolesGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific donation detail' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.donationsService.findOne(id);
  }
}
