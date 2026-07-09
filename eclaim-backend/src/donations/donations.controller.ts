import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DonationsService } from './donations.service';
import {
  ListDonationsQueryDto,
  CreateDonationDto,
  MyDonatedOpportunitiesQueryDto,
} from './dto/donations.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { CustomRequest } from '../types/Request';
import { DonateRequestDto } from './dto/donate-request.dto';

@ApiTags('Donations')
@ApiBearerAuth('access-token')
@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  // ==========================================
  // Donor Flow — crypto transfer to admin wallet
  // ==========================================

  @UseGuards(RolesGuard)
  @Post('donate-request')
  @ApiOperation({
    summary: 'Donor sends crypto to the admin master wallet for an opportunity',
  })
  donateRequest(
    @Body() dto: DonateRequestDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.donationsService.donateRequest(dto, req.user as any);
  }

  // ==========================================
  // Queries
  // ==========================================

  @UseGuards(RolesGuard)
  @Get()
  @ApiOperation({ summary: 'Get paginated donations with filters' })
  findAll(@Query() query: ListDonationsQueryDto) {
    return this.donationsService.findAll(query);
  }

  @UseGuards(RolesGuard)
  @Get('my-donated-opportunities')
  @ApiOperation({
    summary:
      'Get list of unique opportunities the current donor has contributed to',
  })
  myDonatedOpportunities(
    @Query() query: MyDonatedOpportunitiesQueryDto,
    @CurrentUser() req: CustomRequest,
  ) {
    const donorId = req.user.userId;
    return this.donationsService.findMyDonatedOpportunities(donorId, query);
  }

  @UseGuards(RolesGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific donation with full details' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.donationsService.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get the step-by-step audit trail of a donation' })
  getTimeline(@Param('id', ParseIntPipe) id: number) {
    return this.donationsService.getTimeline(id);
  }
}
