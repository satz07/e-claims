import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { ListCampaignsQueryDto } from './dto/campaign-query.dto';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Campaigns')
@ApiBearerAuth('access-token')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @UseGuards(RolesGuard)
  @Get()
  @ApiOperation({ summary: 'Get all campaigns (paginated)' })
  findAll(@Query() query: ListCampaignsQueryDto) {
    return this.campaignsService.findAll(query);
  }

  @UseGuards(RolesGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get campaign details' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.findOne(id);
  }
}
