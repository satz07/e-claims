import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DisbursementsService } from './disbursements.service';
import { SubmitProofDto, RejectProofDto } from './dto/submit-proof.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../database/entities/users.entity';
import { CurrentUser } from '../common/decorators/user.decorator';
import { CustomRequest } from '../types/Request';

@ApiTags('Disbursements')
@ApiBearerAuth('access-token')
@Controller('disbursements')
export class DisbursementsController {
  constructor(private readonly disbursementsService: DisbursementsService) {}

  // ==========================================
  // Business User — Proof Submission
  // ==========================================

  @UseGuards(RolesGuard)
  @Post('milestones/:milestoneId/submit-proof')
  @ApiOperation({
    summary: '(Business) Submit proof documents for milestone completion',
  })
  submitProof(
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @Body() dto: SubmitProofDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.disbursementsService.submitProof(
      milestoneId,
      dto,
      req.user.userId,
    );
  }

  // ==========================================
  // Admin — Proof Review
  // ==========================================

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('milestones/:milestoneId/reject-proof')
  @ApiOperation({
    summary: '(Admin) Reject milestone proof — business must resubmit',
  })
  rejectProof(
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @Body() dto: RejectProofDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.disbursementsService.rejectProof(
      milestoneId,
      dto,
      req.user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('milestones/:milestoneId/approve-proof')
  @ApiOperation({
    summary: '(Admin) Approve milestone proof — marks milestone COMPLETED',
  })
  approveProof(
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.disbursementsService.approveProof(milestoneId, req.user.userId);
  }

  // ==========================================
  // Admin — Disbursement
  // ==========================================

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('milestones/:milestoneId/disburse')
  @ApiOperation({
    summary:
      '(Admin) Disburse aggregated donations for a completed milestone to the business wallet',
  })
  disburseMilestone(
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.disbursementsService.disburseMilestone(
      milestoneId,
      req.user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('opportunities/:opportunityId/complete')
  @ApiOperation({
    summary:
      '(Admin) Mark opportunity as COMPLETED once all milestones are disbursed',
  })
  completeOpportunity(
    @Param('opportunityId', ParseIntPipe) opportunityId: number,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.disbursementsService.completeOpportunity(
      opportunityId,
      req.user.userId,
    );
  }

  // ==========================================
  // Queries
  // ==========================================

  @UseGuards(RolesGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific disbursement record' })
  getDisbursement(@Param('id', ParseIntPipe) id: number) {
    return this.disbursementsService.getDisbursement(id);
  }

  @UseGuards(RolesGuard)
  @Get('milestones/:milestoneId')
  @ApiOperation({ summary: 'List all disbursement records for a milestone' })
  listForMilestone(@Param('milestoneId', ParseIntPipe) milestoneId: number) {
    return this.disbursementsService.listDisbursementsForMilestone(milestoneId);
  }
}
