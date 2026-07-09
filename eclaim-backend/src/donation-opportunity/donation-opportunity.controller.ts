import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { DonationOpportunityService } from './donation-opportunity.service';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  UpdateOpportunityStatusDto,
  CreateProjectPlanDto,
  UpdateProjectPlanDto,
  ListOpportunitiesQueryDto,
} from './dto/opportunity.dto';
import { PaginationQueryDto } from './dto/dashboard.dto';
import {
  CreateBeneficiaryDto,
  UpdateBeneficiaryDto,
} from './dto/beneficiary.dto';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestone.dto';

import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../database/entities/users.entity';
import { CurrentUser } from '../common/decorators/user.decorator';
import { CustomRequest } from '../types/Request';
import {
  AttachmentOwnerType,
  AttachmentType,
} from '../database/entities/attachment.entity';

@ApiTags('Donation Opportunities')
@ApiBearerAuth('access-token')
@Controller()
export class DonationOpportunityController {
  constructor(private readonly service: DonationOpportunityService) {}

  // ==========================================
  // OPPORTUNITIES
  // ==========================================

  @UseGuards(RolesGuard)
  @Post('donation-opportunities')
  @ApiOperation({ summary: 'Create a new donation opportunity' })
  createOpportunity(
    @Body() dto: CreateOpportunityDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.createOpportunity(dto, req.user);
  }

  @UseGuards(RolesGuard)
  @Get('donation-opportunities')
  @ApiOperation({
    summary: 'Get paginated donation opportunities with amount_received',
  })
  findAll(
    @Query() query: ListOpportunitiesQueryDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.findAll(query, req.user);
  }

  @UseGuards(RolesGuard)
  @Get('donation-opportunities/:id')
  @ApiOperation({
    summary: 'Get a specific donation opportunity and its relations',
  })
  @ApiParam({ name: 'id', description: 'Opportunity ID', type: Number })
  @ApiResponse({ status: 200, description: 'Detailed opportunity object' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.findOne(id, req.user);
  }

  // ==========================================
  // OPPORTUNITY DASHBOARD
  // ==========================================

  @UseGuards(RolesGuard)
  @Get('donation-opportunities/:id/overview')
  @ApiOperation({
    summary: 'Dashboard: Totals — donated, disbursed, transaction count',
  })
  @ApiParam({ name: 'id', description: 'Opportunity ID', type: Number })
  @ApiResponse({ status: 200, description: 'Aggregated totals' })
  getOverview(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.getOverview(id, req.user);
  }

  @UseGuards(RolesGuard)
  @Get('donation-opportunities/:id/donors')
  @ApiOperation({
    summary: 'Dashboard: Paginated list of unique donors for an opportunity',
  })
  @ApiParam({ name: 'id', description: 'Opportunity ID', type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by donor email',
  })
  @ApiResponse({ status: 200, description: 'Paginated donor list' })
  getDonors(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.getDonors(
      id,
      req.user,
      query.page,
      query.limit,
      query.search,
    );
  }

  @UseGuards(RolesGuard)
  @Get('donation-opportunities/:id/transactions')
  @ApiOperation({
    summary: 'Dashboard: Paginated donation transactions for an opportunity',
  })
  @ApiParam({ name: 'id', description: 'Opportunity ID', type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by transaction ID',
  })
  @ApiResponse({ status: 200, description: 'Paginated transactions' })
  getTransactions(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.getTransactions(
      id,
      req.user,
      query.page,
      query.limit,
      query.search,
    );
  }

  @UseGuards(RolesGuard)
  @Get('donation-opportunities/:id/milestones')
  @ApiOperation({
    summary:
      'Dashboard: All milestones for an opportunity (flat, across all beneficiaries)',
  })
  @ApiParam({ name: 'id', description: 'Opportunity ID', type: Number })
  @ApiResponse({ status: 200, description: 'List of milestones' })
  getMilestones(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.getMilestones(id, req.user);
  }

  @UseGuards(RolesGuard)
  @Patch('donation-opportunities/:id')
  @ApiOperation({ summary: 'Update a donation opportunity' })
  @ApiParam({ name: 'id', description: 'Opportunity ID', type: Number })
  @ApiResponse({ status: 200, description: 'Updated opportunity' })
  updateOpportunity(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOpportunityDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.updateOpportunity(id, dto, req.user);
  }

  @UseGuards(RolesGuard)
  @Patch('donation-opportunities/:id/request-approval')
  @ApiOperation({ summary: 'Submit a DRAFT opportunity for approval' })
  @ApiParam({ name: 'id', description: 'Opportunity ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Status updated to PENDING_APPROVAL',
  })
  requestApproval(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.requestApproval(id, req.user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('donation-opportunities/:id/status')
  @ApiOperation({
    summary: '(ADMIN) Approve, reject, return, or hold an opportunity',
  })
  @ApiParam({ name: 'id', description: 'Opportunity ID', type: Number })
  @ApiResponse({ status: 200, description: 'Status updated' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOpportunityStatusDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.updateStatus(id, dto, req.user);
  }

  // ==========================================
  // PROJECT PLANS
  // ==========================================

  @UseGuards(RolesGuard)
  @Post('donation-opportunities/:id/project-plan')
  @ApiOperation({ summary: 'Create a project plan for an opportunity' })
  @ApiParam({ name: 'id', description: 'Opportunity ID', type: Number })
  @ApiResponse({ status: 201, description: 'Project plan created' })
  createProjectPlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProjectPlanDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.createProjectPlan(id, dto, req.user);
  }

  @UseGuards(RolesGuard)
  @Patch('project-plans/:id')
  @ApiOperation({ summary: 'Update a project plan' })
  @ApiParam({ name: 'id', description: 'Project Plan ID', type: Number })
  @ApiResponse({ status: 200, description: 'Project plan updated' })
  updateProjectPlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectPlanDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.updateProjectPlan(id, dto, req.user);
  }

  // ==========================================
  // BENEFICIARIES & MILESTONES
  // ==========================================

  @UseGuards(RolesGuard)
  @Post('project-plans/:id/beneficiaries')
  @ApiOperation({
    summary:
      'Add a beneficiary to a project plan (can include nested milestones)',
  })
  @ApiParam({ name: 'id', description: 'Project Plan ID', type: Number })
  @ApiResponse({ status: 201, description: 'Beneficiary added' })
  addBeneficiary(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateBeneficiaryDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.addBeneficiary(id, dto, req.user);
  }

  @UseGuards(RolesGuard)
  @Patch('beneficiaries/:id')
  @ApiOperation({ summary: 'Update a beneficiary' })
  @ApiParam({ name: 'id', description: 'Beneficiary ID', type: Number })
  @ApiResponse({ status: 200, description: 'Beneficiary updated' })
  updateBeneficiary(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBeneficiaryDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.updateBeneficiary(id, dto, req.user);
  }

  @UseGuards(RolesGuard)
  @Delete('beneficiaries/:id')
  @ApiOperation({ summary: 'Delete a beneficiary' })
  @ApiParam({ name: 'id', description: 'Beneficiary ID', type: Number })
  @ApiResponse({ status: 200, description: 'Beneficiary deleted' })
  deleteBeneficiary(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.deleteBeneficiary(id, req.user);
  }

  @UseGuards(RolesGuard)
  @Post('beneficiaries/:id/milestones')
  @ApiOperation({ summary: 'Add a single milestone to a beneficiary' })
  @ApiParam({ name: 'id', description: 'Beneficiary ID', type: Number })
  @ApiResponse({ status: 201, description: 'Milestone added' })
  addMilestone(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMilestoneDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.addMilestone(id, dto, req.user);
  }

  @UseGuards(RolesGuard)
  @Patch('milestones/:id')
  @ApiOperation({ summary: 'Update milestone progress and status' })
  @ApiParam({ name: 'id', description: 'Milestone ID', type: Number })
  @ApiResponse({ status: 200, description: 'Milestone updated' })
  updateMilestone(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMilestoneDto,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.updateMilestone(id, dto, req.user);
  }

  @UseGuards(RolesGuard)
  @Delete('milestones/:id')
  @ApiOperation({ summary: 'Delete a milestone' })
  @ApiParam({ name: 'id', description: 'Milestone ID', type: Number })
  @ApiResponse({ status: 200, description: 'Milestone deleted' })
  deleteMilestone(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.deleteMilestone(id, req.user);
  }

  // ==========================================
  // ATTACHMENTS (AZURE BLOB STORAGE)
  // ==========================================

  @UseGuards(RolesGuard)
  @Post('attachments')
  @ApiOperation({
    summary: 'Upload documents to an opportunity, plan, or milestone',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ownerId: { type: 'number', example: 1 },
        ownerType: { type: 'string', enum: Object.values(AttachmentOwnerType) },
        type: { type: 'string', enum: Object.values(AttachmentType) },
        documents: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
      required: ['ownerType', 'type'],
    },
  })
  @UseInterceptors(
    FilesInterceptor('documents', 5, {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(image\/jpeg|image\/png|application\/pdf)/)) {
          return cb(
            new BadRequestException(
              'Invalid file type. Only JPG, PNG, and PDF allowed.',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async addAttachment(
    @Body('ownerId', new ParseIntPipe({ optional: true })) ownerId: number,
    @Body('ownerType') ownerType: AttachmentOwnerType,
    @Body('type') type: AttachmentType,
    @UploadedFiles() documents: Express.Multer.File[],
  ) {
    if (!documents || documents.length === 0) {
      throw new BadRequestException('At least one document is required');
    }
    return this.service.addAttachment(ownerId, ownerType, type, documents);
  }

  @Get('attachments')
  @ApiOperation({
    summary: 'Get live SAS Azure download links for attachments',
  })
  @ApiQuery({ name: 'ownerId', type: Number })
  @ApiQuery({ name: 'ownerType', enum: AttachmentOwnerType })
  @ApiResponse({
    status: 200,
    description: 'List of attachments with live URLs',
  })
  getAttachments(
    @Query('ownerId', ParseIntPipe) ownerId: number,
    @Query('ownerType') ownerType: AttachmentOwnerType,
  ) {
    return this.service.getAttachments(ownerId, ownerType);
  }

  @UseGuards(RolesGuard)
  @Delete('attachments/:id')
  @ApiOperation({ summary: 'Delete an attachment' })
  @ApiParam({ name: 'id', description: 'Attachment ID', type: Number })
  @ApiResponse({ status: 200, description: 'Attachment deleted' })
  deleteAttachment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() req: CustomRequest,
  ) {
    return this.service.deleteAttachment(id, req.user);
  }
}
