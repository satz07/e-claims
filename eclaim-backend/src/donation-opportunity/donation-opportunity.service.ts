import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { DonationOpportunity } from '../database/entities/donation-opportunity.entity';
import { OpportunityApprovalStatus } from '../database/entities/enums';
import { ProjectPlan } from '../database/entities/project-plan.entity';
import { Beneficiary } from '../database/entities/beneficiary.entity';
import {
  Milestone,
  MilestoneStatus,
} from '../database/entities/milestone.entity';
import {
  Attachment,
  AttachmentOwnerType,
  AttachmentType,
} from '../database/entities/attachment.entity';
import { TransferStatus } from '../database/entities/transfer-history.entity';
import { UserKyc } from '../database/entities/user-kyc.entity';
import { Role } from '../database/entities/users.entity';
import { CustomRequest } from '../types/Request';
import { Donations } from '../database/entities/donations.entity';
import { DonationStep } from '../database/entities/donation.enums';
import { Disbursement } from '../database/entities/disbursement.entity';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  UpdateOpportunityStatusDto,
  CreateProjectPlanDto,
  UpdateProjectPlanDto,
  ListOpportunitiesQueryDto,
} from './dto/opportunity.dto';
import {
  CreateBeneficiaryDto,
  UpdateBeneficiaryDto,
} from './dto/beneficiary.dto';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestone.dto';
import { uploadFilesToAzure, getDocumentUrls } from '../config/s3-config';

@Injectable()
export class DonationOpportunityService {
  constructor(
    @InjectRepository(DonationOpportunity)
    private readonly oppRepo: Repository<DonationOpportunity>,
    @InjectRepository(ProjectPlan)
    private readonly planRepo: Repository<ProjectPlan>,
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepo: Repository<Beneficiary>,
    @InjectRepository(Milestone)
    private readonly milestoneRepo: Repository<Milestone>,
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    @InjectRepository(UserKyc)
    private readonly userKycRepo: Repository<UserKyc>,
    @InjectRepository(Donations)
    private readonly donationsRepo: Repository<Donations>,
    @InjectRepository(Disbursement)
    private readonly disbursementRepo: Repository<Disbursement>,
    private readonly dataSource: DataSource,
  ) {}

  private async syncAttachments(
    ownerId: number,
    ownerType: AttachmentOwnerType,
    ids?: number | number[],
  ) {
    // Step 1: Unlink all previously owned attachments of this type
    await this.attachmentRepo.update({ ownerId, ownerType }, { ownerId: null });

    // Step 2: Link the new set (if any provided)
    if (!ids) return;
    const attachmentIds = Array.isArray(ids) ? ids : [ids];
    if (attachmentIds.length === 0) return;

    await this.attachmentRepo.update(
      { id: In(attachmentIds), ownerType },
      { ownerId },
    );
  }

  private async fetchAttachmentsForOwner(
    ownerId: number,
    ownerType: AttachmentOwnerType,
  ) {
    const atts = await this.attachmentRepo.find({
      where: { ownerId, ownerType },
    });
    return atts.map((a) => ({ ...a, liveUrl: getDocumentUrls(a.fileUrl)[0] }));
  }

  // ---- helpers ----
  private getPocNameFromEmail(email: string): string {
    if (!email) return '';
    const local = email.split('@')[0];
    const parts = local.split(/[._-]/);
    const capitalize = (v: string) =>
      v ? v.charAt(0).toUpperCase() + v.slice(1) : '';
    const firstName = capitalize(parts[0]) || 'User';
    const lastName = capitalize(parts[1]) || '';
    return `${firstName} ${lastName}`.trim();
  }

  private escapeLike(str: string): string {
    return str.replace(/[\\%_]/g, '\\$&');
  }

  private async getAccountType(
    email: string | null,
  ): Promise<string | undefined> {
    if (!email) return undefined;
    const kyc = await this.userKycRepo.findOne({ where: { email } });
    return kyc?.accountType;
  }

  private async assertBusiness(email: string | null) {
    const type = await this.getAccountType(email);
    if (type !== 'Business') {
      throw new ForbiddenException(
        'Only business users can perform this action',
      );
    }
  }

  private assertOwnership(opp: DonationOpportunity, userId: number) {
    if (opp.implementationPartnerId !== userId) {
      throw new ForbiddenException(
        'You can only manage your own opportunities',
      );
    }
  }

  private async assertVisible(
    opp: DonationOpportunity,
    user: CustomRequest['user'],
  ) {
    if (user.role === Role.ADMIN) return;

    const type = await this.getAccountType(user.email);
    if (type === 'Business') {
      this.assertOwnership(opp, user.userId);
      return;
    }

    if (opp.status !== OpportunityApprovalStatus.APPROVED) {
      throw new NotFoundException('Opportunity not found');
    }
  }

  private async assertOpportunityAccess(
    opp: DonationOpportunity | null,
    user: CustomRequest['user'],
  ) {
    if (!opp) throw new NotFoundException('Opportunity not found');
    if (user.role === Role.ADMIN) return;

    const type = await this.getAccountType(user.email);
    if (type === 'Business') {
      this.assertOwnership(opp, user.userId);
      return;
    }

    throw new ForbiddenException('Access denied');
  }

  // ---- opportunities ----
  async createOpportunity(
    dto: CreateOpportunityDto,
    user: CustomRequest['user'],
  ) {
    if (user.role !== Role.ADMIN) {
      await this.assertBusiness(user.email);
    }

    const { bannerId, implementationPartnerId, ...data } = dto;

    // Senior approach: Admins can specify a partner, Business users are forced to use their own ID
    const partnerId =
      user.role === Role.ADMIN && implementationPartnerId
        ? implementationPartnerId
        : user.userId;

    const opp = this.oppRepo.create({
      ...data,
      implementationPartnerId: partnerId,
      status: OpportunityApprovalStatus.DRAFT,
    });
    const savedOpp = await this.oppRepo.save(opp);

    await this.syncAttachments(
      savedOpp.id,
      AttachmentOwnerType.OPPORTUNITY,
      bannerId,
    );

    return savedOpp;
  }

  async findAll(query: ListOpportunitiesQueryDto, user: CustomRequest['user']) {
    const { page = 1, limit = 10, status, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.oppRepo
      .createQueryBuilder('opp')
      .addSelect(
        `(SELECT COALESCE(SUM(CAST(th."amountMinor" AS BIGINT)), 0) FROM transfer_history th WHERE th."opportunityId" = opp.id AND th.status = '${TransferStatus.SUCCESS}')`,
        'amount_received',
      )
      .addSelect(
        `(SELECT att."fileUrl" FROM attachments att WHERE att."ownerId" = opp.id AND att."ownerType" = '${AttachmentOwnerType.OPPORTUNITY}' AND att.type = '${AttachmentType.BANNER}' ORDER BY att."createdAt" DESC LIMIT 1)`,
        'banner_url',
      );

    // 1. Role-based scoping and dynamic status filtering
    if (user.role === Role.ADMIN) {
      if (status) qb.andWhere('opp.status = :status', { status });
    } else {
      const type = await this.getAccountType(user.email);
      if (type === 'Business') {
        qb.andWhere('opp.implementationPartnerId = :userId', {
          userId: user.userId,
        });
        if (status) qb.andWhere('opp.status = :status', { status });
      } else {
        // Individual/Regular: only see approved opportunities
        qb.andWhere('opp.status = :approved', {
          approved: OpportunityApprovalStatus.APPROVED,
        });
      }
    }

    // 2. Global search across title and description
    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      qb.andWhere(
        '(opp.title ILIKE :search OR opp.description ILIKE :search)',
        { search: `%${trimmedSearch}%` },
      );
    }

    const total = await qb.getCount();

    const { entities, raw } = await qb
      .skip(skip)
      .take(limit)
      .getRawAndEntities();

    return {
      data: entities.map((entity, index) => ({
        ...entity,
        amount_received: Number(raw[index].amount_received) || 0,
        bannerUrl: raw[index].banner_url
          ? getDocumentUrls(raw[index].banner_url)[0]
          : null,
      })),
      total,
      page,
      limit,
    };
  }

  async findOne(id: number, user: CustomRequest['user']) {
    const opp = await this.oppRepo.findOne({ where: { id } });
    if (!opp) throw new NotFoundException('Opportunity not found');

    await this.assertVisible(opp, user);

    const plan = await this.planRepo.findOne({
      where: { opportunityId: id },
    });

    if (plan) {
      // Fetch project-plan level attachments
      const planAttachments = await this.attachmentRepo.find({
        where: {
          ownerId: plan.id,
          ownerType: AttachmentOwnerType.PROJECT_PLAN,
        },
      });
      (plan as any).attachments = planAttachments.map((a) => ({
        ...a,
        liveUrl: getDocumentUrls(a.fileUrl)[0],
      }));

      const beneficiaries = await this.beneficiaryRepo.find({
        where: { projectPlanId: plan.id },
      });

      if (beneficiaries.length > 0) {
        const beneficiaryIds = [...new Set(beneficiaries.map((b) => b.id))];
        const milestones = await this.milestoneRepo.find({
          where: { beneficiaryId: In(beneficiaryIds) },
        });

        if (milestones.length > 0) {
          const milestoneIds = milestones.map((m) => m.id);
          const attachments = await this.attachmentRepo.find({
            where: {
              ownerId: In(milestoneIds),
              ownerType: AttachmentOwnerType.MILESTONE,
            },
          });

          for (const m of milestones) {
            (m as any).attachments = attachments
              .filter((a) => a.ownerId === m.id)
              .map((a) => ({
                ...a,
                liveUrl: getDocumentUrls(a.fileUrl)[0],
              }));
          }
        }

        for (const b of beneficiaries) {
          (b as any).milestones = milestones.filter(
            (m) => m.beneficiaryId === b.id,
          );
        }
      }

      (plan as any).beneficiaries = beneficiaries;
      (opp as any).projectPlan = plan;
    }

    const result = await this.oppRepo
      .createQueryBuilder('opp')
      .where('opp.id = :id', { id })
      .addSelect(
        `(SELECT COALESCE(SUM(CAST(th."amountMinor" AS BIGINT)), 0) FROM transfer_history th WHERE th."opportunityId" = opp.id AND th.status = '${TransferStatus.SUCCESS}')`,
        'amount_received',
      )
      .addSelect(
        `(SELECT u.email FROM users u WHERE u.id = opp."implementationPartnerId")`,
        'partner_email',
      )
      .addSelect(
        `(SELECT u."createdAt" FROM users u WHERE u.id = opp."implementationPartnerId")`,
        'partner_created_at',
      )
      .addSelect(
        `(SELECT k."phoneNumber" FROM user_kyc k JOIN users u ON u.email = k.email WHERE u.id = opp."implementationPartnerId")`,
        'partner_mobile',
      )
      .getRawOne();

    const banner = await this.attachmentRepo.findOne({
      where: {
        ownerId: id,
        ownerType: AttachmentOwnerType.OPPORTUNITY,
        type: AttachmentType.BANNER,
      },
      order: { createdAt: 'DESC' },
    });

    const oppDocuments = await this.attachmentRepo.find({
      where: {
        ownerId: id,
        ownerType: AttachmentOwnerType.OPPORTUNITY,
        type: AttachmentType.DOCUMENT,
      },
    });

    let implementing_partner = null;
    if (opp.implementationPartnerId && result?.partner_email) {
      implementing_partner = {
        id: opp.implementationPartnerId,
        poc_name: this.getPocNameFromEmail(result.partner_email),
        email: result.partner_email,
        mobile: result.partner_mobile || null,
        member_since: result.partner_created_at,
      };
    }

    delete (opp as any).implementationPartnerId;
    (opp as any).implementing_partner = implementing_partner;

    return {
      ...opp,
      amount_received: Number(result?.amount_received) || 0,
      bannerUrl: banner ? getDocumentUrls(banner.fileUrl)[0] : null,
      documents: oppDocuments.map((a) => ({
        ...a,
        liveUrl: getDocumentUrls(a.fileUrl)[0],
      })),
    };
  }

  async updateOpportunity(
    id: number,
    dto: UpdateOpportunityDto,
    user: CustomRequest['user'],
  ) {
    const opp = await this.findOne(id, user);

    if (user.role !== Role.ADMIN) {
      await this.assertBusiness(user.email);
    }

    delete (dto as any).implementationPartnerId;

    Object.assign(opp, dto);
    delete (opp as any).amount_received;
    const saved = await this.oppRepo.save(opp);

    if (dto.bannerId) {
      await this.syncAttachments(
        saved.id,
        AttachmentOwnerType.OPPORTUNITY,
        dto.bannerId,
      );
    }

    return saved;
  }

  async requestApproval(id: number, user: CustomRequest['user']) {
    await this.assertBusiness(user.email);
    const opp = await this.findOne(id, user);

    if (
      opp.status !== OpportunityApprovalStatus.DRAFT &&
      opp.status !== OpportunityApprovalStatus.RETURNED
    ) {
      throw new BadRequestException(
        'Only DRAFT or RETURNED opportunities can be submitted for approval',
      );
    }
    opp.status = OpportunityApprovalStatus.PENDING_APPROVAL;
    delete (opp as any).amount_received;
    return this.oppRepo.save(opp);
  }

  async updateStatus(
    id: number,
    dto: UpdateOpportunityStatusDto,
    user: CustomRequest['user'],
  ) {
    const opp = await this.findOne(id, user);

    const isApproving =
      opp.status !== OpportunityApprovalStatus.APPROVED &&
      dto.status === OpportunityApprovalStatus.APPROVED;

    opp.status = dto.status;
    if (dto.reason !== undefined) {
      opp.statusReason = dto.reason;
    }
    delete (opp as any).amount_received;
    const savedOpp = await this.oppRepo.save(opp);

    if (isApproving) {
      const firstMilestone = await this.dataSource
        .createQueryBuilder()
        .select('m.id', 'id')
        .from('milestones', 'm')
        .innerJoin('beneficiaries', 'b', 'b.id = m."beneficiaryId"')
        .innerJoin('project_plans', 'pp', 'pp.id = b."projectPlanId"')
        .where('pp."opportunityId" = :oppId', { oppId: id })
        .orderBy('b.id', 'ASC')
        .addOrderBy('m.id', 'ASC')
        .limit(1)
        .getRawOne();

      if (firstMilestone) {
        await this.milestoneRepo.update(firstMilestone.id, {
          status: MilestoneStatus.IN_PROGRESS,
        });
      }
    }

    return savedOpp;
  }

  // --- Project Plan ---
  async createProjectPlan(
    opportunityId: number,
    dto: CreateProjectPlanDto,
    user: CustomRequest['user'],
  ) {
    const opp = await this.oppRepo.findOne({ where: { id: opportunityId } });
    await this.assertOpportunityAccess(opp, user);
    const { attachmentIds, ...data } = dto;
    const plan = this.planRepo.create({ ...data, opportunityId });
    const saved = await this.planRepo.save(plan);

    await this.syncAttachments(
      saved.id,
      AttachmentOwnerType.PROJECT_PLAN,
      attachmentIds,
    );

    return {
      ...saved,
      attachments: await this.fetchAttachmentsForOwner(
        saved.id,
        AttachmentOwnerType.PROJECT_PLAN,
      ),
    };
  }

  async updateProjectPlan(
    id: number,
    dto: UpdateProjectPlanDto,
    user: CustomRequest['user'],
  ) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Project plan not found');
    const opp = await this.oppRepo.findOne({
      where: { id: plan.opportunityId },
    });
    await this.assertOpportunityAccess(opp, user);
    const { attachmentIds, ...data } = dto;
    Object.assign(plan, data);
    const saved = await this.planRepo.save(plan);

    await this.syncAttachments(
      saved.id,
      AttachmentOwnerType.PROJECT_PLAN,
      attachmentIds,
    );

    return {
      ...saved,
      attachments: await this.fetchAttachmentsForOwner(
        saved.id,
        AttachmentOwnerType.PROJECT_PLAN,
      ),
    };
  }

  async updateBeneficiary(
    id: number,
    dto: UpdateBeneficiaryDto,
    user: CustomRequest['user'],
  ) {
    const ben = await this.beneficiaryRepo.findOne({ where: { id } });
    if (!ben) throw new NotFoundException('Beneficiary not found');
    const plan = await this.planRepo.findOne({
      where: { id: ben.projectPlanId },
    });
    if (!plan) throw new NotFoundException('Project plan not found');
    const opp = await this.oppRepo.findOne({
      where: { id: plan.opportunityId },
    });
    await this.assertOpportunityAccess(opp, user);
    Object.assign(ben, dto);
    return this.beneficiaryRepo.save(ben);
  }

  async deleteBeneficiary(id: number, user: CustomRequest['user']) {
    const ben = await this.beneficiaryRepo.findOne({ where: { id } });
    if (!ben) throw new NotFoundException('Beneficiary not found');
    const plan = await this.planRepo.findOne({
      where: { id: ben.projectPlanId },
    });
    if (!plan) throw new NotFoundException('Project plan not found');
    const opp = await this.oppRepo.findOne({
      where: { id: plan.opportunityId },
    });
    await this.assertOpportunityAccess(opp, user);
    return this.beneficiaryRepo.delete(id);
  }

  async deleteMilestone(id: number, user: CustomRequest['user']) {
    const milestone = await this.milestoneRepo.findOne({ where: { id } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    const ben = await this.beneficiaryRepo.findOne({
      where: { id: milestone.beneficiaryId },
    });
    if (!ben) throw new NotFoundException('Beneficiary not found');
    const plan = await this.planRepo.findOne({
      where: { id: ben.projectPlanId },
    });
    if (!plan) throw new NotFoundException('Project plan not found');
    const opp = await this.oppRepo.findOne({
      where: { id: plan.opportunityId },
    });
    await this.assertOpportunityAccess(opp, user);
    return this.milestoneRepo.delete(id);
  }

  async deleteAttachment(id: number, user: CustomRequest['user']) {
    const att = await this.attachmentRepo.findOne({ where: { id } });
    if (!att) throw new NotFoundException('Attachment not found');

    let oppId: number;
    if (att.ownerType === AttachmentOwnerType.OPPORTUNITY) {
      oppId = att.ownerId;
    } else if (att.ownerType === AttachmentOwnerType.PROJECT_PLAN) {
      const plan = await this.planRepo.findOne({ where: { id: att.ownerId } });
      if (!plan) throw new NotFoundException('Project plan not found');
      oppId = plan.opportunityId;
    } else {
      // MILESTONE
      const milestone = await this.milestoneRepo.findOne({
        where: { id: att.ownerId },
      });
      if (!milestone) throw new NotFoundException('Milestone not found');
      const ben = await this.beneficiaryRepo.findOne({
        where: { id: milestone.beneficiaryId },
      });
      if (!ben) throw new NotFoundException('Beneficiary not found');
      const plan = await this.planRepo.findOne({
        where: { id: ben.projectPlanId },
      });
      if (!plan) throw new NotFoundException('Project plan not found');
      oppId = plan.opportunityId;
    }

    const opp = await this.oppRepo.findOne({ where: { id: oppId } });
    await this.assertOpportunityAccess(opp, user);
    return this.attachmentRepo.delete(id);
  }

  // --- Beneficiary & Milestones (Transaction) ---
  async addBeneficiary(
    projectPlanId: number,
    dto: CreateBeneficiaryDto,
    user: CustomRequest['user'],
  ) {
    const plan = await this.planRepo.findOne({ where: { id: projectPlanId } });
    if (!plan) throw new NotFoundException('Project plan not found');
    const opp = await this.oppRepo.findOne({
      where: { id: plan.opportunityId },
    });
    await this.assertOpportunityAccess(opp, user);
    return this.dataSource.transaction(async (manager) => {
      const beneficiary = manager.create(Beneficiary, {
        projectPlanId,
        name: dto.name,
      });
      const savedBeneficiary = await manager.save(beneficiary);

      if (dto.milestones?.length) {
        for (const milestoneDto of dto.milestones) {
          const { attachmentIds, ...mdata } = milestoneDto;
          const milestone = manager.create(Milestone, {
            ...mdata,
            beneficiaryId: savedBeneficiary.id,
          });
          const savedMilestone = await manager.save(milestone);

          if (attachmentIds?.length) {
            await manager.update(
              Attachment,
              {
                id: In(attachmentIds),
                ownerType: AttachmentOwnerType.MILESTONE,
              },
              { ownerId: savedMilestone.id },
            );
          }
        }
        const milestones = await manager.find(Milestone, {
          where: { beneficiaryId: savedBeneficiary.id },
        });
        (savedBeneficiary as any).milestones = milestones;
      }

      return savedBeneficiary;
    });
  }

  async addMilestone(
    beneficiaryId: number,
    dto: CreateMilestoneDto,
    user: CustomRequest['user'],
  ) {
    const ben = await this.beneficiaryRepo.findOne({
      where: { id: beneficiaryId },
    });
    if (!ben) throw new NotFoundException('Beneficiary not found');
    const plan = await this.planRepo.findOne({
      where: { id: ben.projectPlanId },
    });
    if (!plan) throw new NotFoundException('Project plan not found');
    const opp = await this.oppRepo.findOne({
      where: { id: plan.opportunityId },
    });
    await this.assertOpportunityAccess(opp, user);
    const { attachmentIds, ...data } = dto;
    const milestone = this.milestoneRepo.create({ ...data, beneficiaryId });
    const savedMilestone = await this.milestoneRepo.save(milestone);

    await this.syncAttachments(
      savedMilestone.id,
      AttachmentOwnerType.MILESTONE,
      attachmentIds,
    );

    return {
      ...savedMilestone,
      attachments: await this.fetchAttachmentsForOwner(
        savedMilestone.id,
        AttachmentOwnerType.MILESTONE,
      ),
    };
  }

  async updateMilestone(
    id: number,
    dto: UpdateMilestoneDto,
    user: CustomRequest['user'],
  ) {
    const milestone = await this.milestoneRepo.findOne({ where: { id } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    const ben = await this.beneficiaryRepo.findOne({
      where: { id: milestone.beneficiaryId },
    });
    if (!ben) throw new NotFoundException('Beneficiary not found');
    const plan = await this.planRepo.findOne({
      where: { id: ben.projectPlanId },
    });
    if (!plan) throw new NotFoundException('Project plan not found');
    const opp = await this.oppRepo.findOne({
      where: { id: plan.opportunityId },
    });
    await this.assertOpportunityAccess(opp, user);
    const { attachmentIds, ...data } = dto;
    Object.assign(milestone, data);
    const saved = await this.milestoneRepo.save(milestone);

    await this.syncAttachments(
      saved.id,
      AttachmentOwnerType.MILESTONE,
      attachmentIds,
    );

    return {
      ...saved,
      attachments: await this.fetchAttachmentsForOwner(
        saved.id,
        AttachmentOwnerType.MILESTONE,
      ),
    };
  }
  async addAttachment(
    ownerId: number | null,
    ownerType: AttachmentOwnerType,
    type: AttachmentType,
    files: Express.Multer.File[],
  ) {
    const blobPaths = await uploadFilesToAzure(
      files,
      `attachments/${ownerType.toLowerCase()}/${ownerId ?? 'temp'}`,
    );

    const attachments = blobPaths.map((path, idx) =>
      this.attachmentRepo.create({
        ownerId,
        ownerType,
        type,
        fileUrl: path,
        fileName: files[idx].originalname,
      }),
    );
    return this.attachmentRepo.save(attachments);
  }

  async getAttachments(ownerId: number, ownerType: AttachmentOwnerType) {
    const attachments = await this.attachmentRepo.find({
      where: { ownerId, ownerType },
    });
    return attachments.map((att) => ({
      ...att,
      liveUrl: getDocumentUrls(att.fileUrl)[0],
    }));
  }

  // ================================================================
  // Dashboard APIs (Overview / Donors / Transactions / Milestones)
  // ================================================================

  /**
   * GET /donation-opportunities/:id/overview
   * Returns 3 aggregated numbers for the opportunity:
   *  - totalDonated     (sum of amountMinor for TRANSFERRED + DISBURSED donations, in major units)
   *  - totalDisbursed   (sum of successful disbursements for this opportunity)
   *  - totalTransactions (count of all donation rows)
   */
  async getOverview(opportunityId: number, user: CustomRequest['user']) {
    const opp = await this.oppRepo.findOne({ where: { id: opportunityId } });
    await this.assertVisible(opp!, user);

    const [[donated], [disbursed], [txCount]] = await Promise.all([
      // Total crypto received (donor → admin wallet)
      this.dataSource.query<{ total: string }[]>(
        `
        SELECT COALESCE(SUM(CAST("amountMinor" AS BIGINT)), 0)::text AS total
        FROM donations
        WHERE "opportunityId" = $1
          AND "donationStep" IN ('${DonationStep.TRANSFERRED}', '${DonationStep.DISBURSED}')
      `,
        [opportunityId],
      ),

      // Total disbursed to business wallet
      this.dataSource.query<{ total: string }[]>(
        `
        SELECT COALESCE(SUM(CAST("totalAmountMinor" AS BIGINT)), 0)::text AS total
        FROM disbursements
        WHERE "opportunityId" = $1
          AND status = 'SUCCESS'
      `,
        [opportunityId],
      ),

      // All transaction rows (any step)
      this.dataSource.query<{ count: string }[]>(
        `
        SELECT COUNT(*) AS count
        FROM donations
        WHERE "opportunityId" = $1
      `,
        [opportunityId],
      ),
    ]);

    return {
      opportunityId,
      totalDonated: Number(donated.total),
      totalDisbursed: Number(disbursed.total),
      totalTransactions: Number(txCount.count),
    };
  }

  /**
   * GET /donation-opportunities/:id/donors?page=1&limit=20
   * Returns a paginated list of unique donors who donated to this opportunity.
   * Each row: donorId, email, displayName, totalDonated, donationCount, lastDonatedAt
   */
  async getDonors(
    opportunityId: number,
    user: CustomRequest['user'],
    page = 1,
    limit = 20,
    search?: string,
  ) {
    const opp = await this.oppRepo.findOne({ where: { id: opportunityId } });
    await this.assertVisible(opp!, user);

    const offset = (page - 1) * limit;
    const searchPattern = search ? `%${this.escapeLike(search.trim())}%` : null;
    const searchFilter = searchPattern
      ? "AND u.email ILIKE $4 ESCAPE '\\'"
      : '';
    const queryParams = searchPattern
      ? [opportunityId, limit, offset, searchPattern]
      : [opportunityId, limit, offset];

    const [rows, [countRow]] = await Promise.all([
      this.dataSource.query<any[]>(
        `
        SELECT
          d."donorId"                                                AS "donorId",
          u.email                                                    AS email,
          COALESCE(k."phoneNumber", '')                              AS mobile,
          COALESCE(SUM(CAST(d."amountMinor" AS BIGINT)), 0)::text   AS "totalAmountMinor",
          d.currency                                                 AS currency,
          COUNT(d.id)::int                                           AS "donationCount",
          MAX(d."donatedAt")                                         AS "lastDonatedAt",
          w.address                                                  AS "walletAddress"
        FROM donations d
        JOIN users u ON u.id = d."donorId"
        LEFT JOIN user_kyc k ON k.email = u.email
        LEFT JOIN wallets w ON w."userId" = u.id
        WHERE d."opportunityId" = $1 ${searchFilter}
        GROUP BY d."donorId", u.email, k."phoneNumber", d.currency, w.address
        ORDER BY MAX(d."donatedAt") DESC
        LIMIT $2 OFFSET $3
      `,
        queryParams,
      ),

      this.dataSource.query<{ total: string }[]>(
        `
        SELECT COUNT(DISTINCT d."donorId")::text AS total
        FROM donations d
        JOIN users u ON u.id = d."donorId"
        WHERE d."opportunityId" = $1 ${
          searchPattern ? "AND u.email ILIKE $2 ESCAPE '\\'" : ''
        }
      `,
        searchPattern ? [opportunityId, searchPattern] : [opportunityId],
      ),
    ]);

    return {
      data: rows.map((r) => ({
        donorId: r.donorId,
        displayName: this.getPocNameFromEmail(r.email),
        email: r.email,
        mobile: r.mobile || null,
        walletAddress: r.walletAddress || null,
        totalAmountMinor: r.totalAmountMinor,
        currency: r.currency,
        donationCount: r.donationCount,
        lastDonatedAt: r.lastDonatedAt,
      })),
      total: Number(countRow.total),
      page,
      limit,
    };
  }

  /**
   * GET /donation-opportunities/:id/transactions?page=1&limit=20
   * Returns all donation rows for this opportunity.
   * Columns: transactionId, donorId, donorEmail, amountMinor, currency, donationStep, donatedAt
   */
  async getTransactions(
    opportunityId: number,
    user: CustomRequest['user'],
    page = 1,
    limit = 20,
    search?: string,
  ) {
    const opp = await this.oppRepo.findOne({ where: { id: opportunityId } });
    await this.assertVisible(opp!, user);

    const offset = (page - 1) * limit;
    const searchPattern = search ? `%${this.escapeLike(search.trim())}%` : null;
    const searchFilter = searchPattern
      ? 'AND d."transactionId" ILIKE $4 ESCAPE \'\\\''
      : '';
    const queryParams = searchPattern
      ? [opportunityId, limit, offset, searchPattern]
      : [opportunityId, limit, offset];

    const [rows, [countRow]] = await Promise.all([
      this.dataSource.query<any[]>(
        `
        SELECT
          d.id                                   AS "donationId",
          d."transactionId"                      AS "transactionId",
          d."donorId"                            AS "donorId",
          u.email                                AS "userEmail",
          CAST(d."amountMinor" AS BIGINT)::text  AS "amountMinor",
          d.currency                             AS currency,
          d."donationStep"                       AS status,
          d."donatedAt"                          AS "donatedAt",
          d."milestoneId"                        AS "milestoneId"
        FROM donations d
        JOIN users u ON u.id = d."donorId"
        WHERE d."opportunityId" = $1 ${searchFilter}
        ORDER BY d."donatedAt" DESC
        LIMIT $2 OFFSET $3
      `,
        queryParams,
      ),

      this.dataSource.query<{ total: string }[]>(
        `
        SELECT COUNT(*)::text AS total
        FROM donations d
        WHERE d."opportunityId" = $1 ${
          searchPattern ? 'AND d."transactionId" ILIKE $2 ESCAPE \'\\\'' : ''
        }
      `,
        searchPattern ? [opportunityId, searchPattern] : [opportunityId],
      ),
    ]);

    return {
      data: rows,
      total: Number(countRow.total),
      page,
      limit,
    };
  }

  /**
   * GET /donation-opportunities/:id/milestones
   * Returns all milestones across all beneficiaries for this opportunity.
   * Columns: id, title, targetAmount, currency, startDate, endDate, status, disbursedAt
   */
  async getMilestones(opportunityId: number, user: CustomRequest['user']) {
    const opp = await this.oppRepo.findOne({ where: { id: opportunityId } });
    await this.assertVisible(opp!, user);

    const milestones = await this.dataSource.query<any[]>(
      `
      SELECT
        m.id                   AS id,
        m.title                AS title,
        m."targetAmount"       AS "targetAmount",
        m.currency             AS currency,
        m."startDate"          AS "startDate",
        m."endDate"            AS "endDate",
        m.status               AS status,
        m."disbursedAt"        AS "disbursedAt",
        m."proofRejectionReason" AS "proofRejectionReason",
        b.name                 AS "beneficiaryName",
        COALESCE(
          (
            SELECT SUM(CAST(d2."amountMinor" AS BIGINT))
            FROM donations d2
            WHERE d2."milestoneId" = m.id
              AND d2."donationStep" IN ('${DonationStep.TRANSFERRED}', '${DonationStep.DISBURSED}')
          ), 0
        )::text                AS "amountCollectedMinor"
      FROM milestones m
      JOIN beneficiaries b ON b.id = m."beneficiaryId"
      JOIN project_plans pp ON pp.id = b."projectPlanId"
      WHERE pp."opportunityId" = $1
      ORDER BY m."startDate" ASC
    `,
      [opportunityId],
    );

    return { data: milestones, total: milestones.length };
  }
}
