import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Donations } from '../database/entities/donations.entity';
import {
  DonationStep,
  DonationStepEntry,
  DonationPaymentSource,
} from '../database/entities/donation.enums';
import { DonationOpportunity } from '../database/entities/donation-opportunity.entity';
import {
  ListDonationsQueryDto,
  CreateDonationDto,
  MyDonatedOpportunitiesQueryDto,
} from './dto/donations.dto';
import { assertTransition } from './donations.state-machine';
import { CommonResponse } from '../common/common-response';
import { User, Role } from '../database/entities/users.entity';
import { WalletService } from '../wallet/wallet.service';
import { MilestoneStatus } from '../database/entities/milestone.entity';
import { DonateRequestDto } from './dto/donate-request.dto';
import { SignedPostDto } from '../wallet/dto/signed-post.dto';

@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);

  constructor(
    @InjectRepository(Donations)
    private readonly donationsRepo: Repository<Donations>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
  ) {}

  // ================================================================
  // Helpers
  // ================================================================

  /**
   * Resolves the on-chain token amount (bigint-compatible string).
   *
   * Priority:
   *  1. `Amount` — if it is a non-empty string that parses to a positive integer, use it directly.
   *  2. `humanAmount` + `decimals` — multiply: amountMinor = humanAmount × 10^decimals.
   *
   * Throws BadRequestException if neither source yields a valid positive integer.
   */
  private resolveAmountMinor(
    Amount: string | undefined,
    humanAmount: string | undefined,
    decimals: string | undefined,
  ): string {
    // 1. Try Amount first (raw minor units already scaled)
    if (Amount && Amount.trim() !== '') {
      const parsed = BigInt(Amount.trim()); // throws SyntaxError if invalid
      if (parsed <= 0n) {
        throw new BadRequestException('Amount must be a positive integer');
      }
      return parsed.toString();
    }

    // 2. Derive from humanAmount × 10^decimals
    if (humanAmount && humanAmount.trim() !== '') {
      const dec = parseInt(decimals ?? '0', 10);
      if (isNaN(dec) || dec < 0) {
        throw new BadRequestException('Invalid asset decimals');
      }
      // Use BigInt math to avoid floating-point drift
      const [intPart = '0', fracPart = ''] = humanAmount.trim().split('.');
      const fracPadded = fracPart.padEnd(dec, '0').slice(0, dec);
      const minor =
        BigInt(intPart) * BigInt(10 ** dec) + BigInt(fracPadded || '0');
      if (minor <= 0n) {
        throw new BadRequestException('humanAmount must be positive');
      }
      return minor.toString();
    }

    throw new BadRequestException(
      'Either Amount (raw minor units) or humanAmount must be provided and non-empty',
    );
  }

  private buildStepEntry(
    fromStep: DonationStep | null,
    toStep: DonationStep,
    triggeredBy: number | null,
    reason?: string,
    metadata?: Record<string, any>,
  ): DonationStepEntry {
    return {
      fromStep,
      toStep,
      at: new Date().toISOString(),
      triggeredBy,
      ...(reason ? { reason } : {}),
      ...(metadata ? { metadata } : {}),
    };
  }

  async getDonationOrFail(id: number): Promise<Donations> {
    const donation = await this.donationsRepo.findOne({ where: { id } });
    if (!donation) {
      throw new NotFoundException(`Donation with ID ${id} not found`);
    }
    return donation;
  }

  async applyTransition(
    donation: Donations,
    toStep: DonationStep,
    triggeredBy: number | null,
    extras?: {
      reason?: string;
      metadata?: Record<string, any>;
      disbursementId?: number;
    },
  ): Promise<Donations> {
    const fromStep = donation.donationStep;

    assertTransition(fromStep, toStep);

    const entry = this.buildStepEntry(
      fromStep,
      toStep,
      triggeredBy,
      extras?.reason,
      extras?.metadata,
    );

    donation.donationStep = toStep;
    donation.stepHistory = [...(donation.stepHistory || []), entry];

    if (
      extras?.reason &&
      (toStep === DonationStep.FAILED || toStep === DonationStep.CANCELLED)
    ) {
      donation.failureReason = extras.reason;
    }

    if (extras?.disbursementId) {
      donation.disbursementId = extras.disbursementId;
    }

    return this.donationsRepo.save(donation);
  }

  // ================================================================
  // CRUD
  // ================================================================

  async create(dto: CreateDonationDto, donorId: number) {
    const donation = this.donationsRepo.create({
      donorId,
      campaignId: dto.campaignId,
      opportunityId: dto.opportunityId,
      beneficiaryId: dto.beneficiaryId,
      milestoneId: dto.milestoneId,
      amountMinor: dto.amountMinor,
      currency: dto.currency,
      paymentSource: dto.paymentSource,
      walletId: dto.walletId ?? null,
      metadata: dto.metadata ?? null,
      donationStep: DonationStep.INITIATED,
      donatedAt: new Date(),
      stepHistory: [this.buildStepEntry(null, DonationStep.INITIATED, donorId)],
    });

    const saved = await this.donationsRepo.save(donation);
    return new CommonResponse(201, saved, 'Donation created successfully');
  }

  // ================================================================
  // Donate Request — donor sends crypto to admin master wallet
  // ================================================================

  async donateRequest(dto: DonateRequestDto, user: User) {
    // The logger middleware injects { userId } not { id } — resolve safely from either shape
    const donorId: number = (user as any).userId ?? user.id;

    if (!donorId) {
      throw new BadRequestException(
        'Unable to resolve donor identity from token',
      );
    }

    if (!user.wallet?.walletId) {
      throw new BadRequestException(
        'User does not have a wallet to donate from',
      );
    }

    // Resolve admin (master wallet holder)
    const admin = await this.userRepo.findOne({
      where: { role: Role.ADMIN },
      relations: ['wallet'],
    });

    if (!admin || !admin.wallet || !admin.wallet.address) {
      throw new BadRequestException(
        'Admin wallet not found for receiving donations',
      );
    }

    const opportunityId = parseInt(dto.payload.opportunityId, 10);
    if (isNaN(opportunityId)) {
      throw new BadRequestException('Invalid opportunityId provided');
    }

    const opportunity = (await this.userRepo.manager.findOne(
      'DonationOpportunity',
      { where: { id: opportunityId } },
    )) as any;

    if (!opportunity) {
      throw new BadRequestException('Donation Opportunity not found');
    }

    // Find the currently IN_PROGRESS milestone to assign this donation to
    const activeMilestone = (await this.userRepo.manager
      .createQueryBuilder('Milestone', 'm')
      .innerJoin('Beneficiary', 'b', 'b.id = m.beneficiaryId')
      .innerJoin('ProjectPlan', 'pp', 'pp.id = b.projectPlanId')
      .where('pp.opportunityId = :opportunityId', { opportunityId })
      .andWhere('m.status = :status', { status: 'in_progress' })
      .getOne()) as any;

    const campaignId = opportunity?.campaignId;

    const projectPlan = (await this.userRepo.manager.findOne('ProjectPlan', {
      where: { opportunityId },
    })) as any;

    const beneficiary = projectPlan
      ? ((await this.userRepo.manager.findOne('Beneficiary', {
          where: { projectPlanId: projectPlan.id },
        })) as any)
      : null;

    // 1. Resolve DDSC asset metadata from DFNS — same pattern as disbursements
    //    This guarantees the contract/decimals are what DFNS actually recognises
    let ddscAsset: Awaited<
      ReturnType<typeof this.walletService.findWalletAsset>
    >;
    try {
      ddscAsset = await this.walletService.findWalletAsset(
        user.wallet.walletId,
        'DDSC',
      );
    } catch {
      throw new BadRequestException(
        'DDSC token not found on your wallet. Please ensure your wallet holds DDSC before donating.',
      );
    }

    // 2. Resolve amountMinor using the real decimals from DFNS
    const amountMinor = this.resolveAmountMinor(
      dto.payload.Amount,
      dto.payload.humanAmount,
      String(ddscAsset.decimals),
    );

    // 3. Create the donation record FIRST (pre-creation pattern for auditability)
    const createDonationDto: CreateDonationDto = {
      campaignId,
      opportunityId,
      beneficiaryId: beneficiary?.id,
      milestoneId: activeMilestone?.id ?? null,
      amountMinor,
      currency: ddscAsset.symbol,
      paymentSource: DonationPaymentSource.WALLET,
      walletId: user.wallet.walletId,
    };

    const donationCreation = await this.create(createDonationDto, donorId);
    const donationData = donationCreation.data;

    // 4. Map the payload for DFNS — asset comes from DFNS registry, not caller
    // Note: no httpPath — sendAsset defaults to /wallets/{walletId}/transfers
    const mappedPayload: SignedPostDto = {
      payload: {
        humanAmount: dto.payload.humanAmount ?? dto.payload.Amount,
        asset: {
          kind: 'Erc20',
          symbol: ddscAsset.symbol,
          contract: ddscAsset.contract,
          decimals: ddscAsset.decimals,
        },
        destination: { address: admin.wallet.address },
      },
    } as SignedPostDto;

    // 3. Execute the transfer
    let transferResult: any;
    try {
      transferResult = await this.walletService.sendAsset(
        mappedPayload,
        user.wallet.walletId,
      );
    } catch (error) {
      // Update donation to FAILED with reason
      try {
        await this.applyTransition(donationData, DonationStep.FAILED, donorId, {
          reason: error instanceof Error ? error.message : 'Transfer failed',
        });
      } catch (transitionError) {
        this.logger.error(
          `Failed to transition donation ${donationData.id} to FAILED`,
          transitionError,
        );
      }
      throw error;
    }

    // 4. Update to TRANSFERRED and store the DFNS transaction ID
    const dfnsTransferId = (transferResult as any)?.id ?? null;
    donationData.transactionId = dfnsTransferId;

    try {
      await this.applyTransition(
        donationData,
        DonationStep.TRANSFERRED,
        donorId,
        { metadata: { dfnsTransferId } },
      );
    } catch (dbError) {
      this.logger.error(
        `CRITICAL: Failed to mark donation ${donationData.id} as TRANSFERRED`,
        dbError,
      );
    }

    // 5. Return donation ID and DFNS transfer receipt
    return new CommonResponse(
      200,
      {
        donationId: donationData.id,
        milestoneId: activeMilestone?.id ?? null,
        transfer: transferResult,
      },
      'Donate request initiated successfully',
    );
  }

  // ================================================================
  // Queries
  // ================================================================

  async findAll(query: ListDonationsQueryDto) {
    const {
      page = 1,
      limit = 10,
      donationStep,
      paymentSource,
      ...filters
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.donationsRepo
      .createQueryBuilder('donation')
      .leftJoinAndSelect('donation.opportunity', 'opportunity')
      .leftJoinAndSelect('donation.campaign', 'campaign');

    const allowedFilters = [
      'campaignId',
      'opportunityId',
      'beneficiaryId',
      'milestoneId',
      'donorId',
    ];
    for (const key of allowedFilters) {
      if (filters[key] !== undefined) {
        qb.andWhere(`donation.${key} = :${key}`, { [key]: filters[key] });
      }
    }

    if (donationStep) {
      qb.andWhere('donation.donationStep = :donationStep', { donationStep });
    }

    if (paymentSource) {
      qb.andWhere('donation.paymentSource = :paymentSource', { paymentSource });
    }

    const [data, total] = await qb
      .orderBy('donation.donatedAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return new CommonResponse(
      200,
      { data, total, page, limit },
      'Donations retrieved',
    );
  }

  async findOne(id: number) {
    const donation = await this.donationsRepo.findOne({
      where: { id },
      relations: [
        'opportunity',
        'campaign',
        'beneficiary',
        'milestone',
        'donor',
      ],
    });

    if (!donation) {
      throw new NotFoundException(`Donation with ID ${id} not found`);
    }

    return new CommonResponse(200, donation, 'Donation retrieved');
  }

  async getTimeline(id: number) {
    const donation = await this.getDonationOrFail(id);
    return new CommonResponse(
      200,
      {
        donationId: id,
        currentStep: donation.donationStep,
        timeline: donation.stepHistory,
      },
      'Donation timeline retrieved',
    );
  }

  /**
   * Returns a unique list of opportunities the donor has contributed to,
   * including their total contribution per opportunity.
   */
  async findMyDonatedOpportunities(
    donorId: number,
    query: MyDonatedOpportunitiesQueryDto,
  ) {
    try {
      const { page = 1, limit = 10, search } = query;
      const skip = (page - 1) * limit;

      // Use the Entity class reference instead of a string for type safety
      const qb = this.donationsRepo.manager
        .createQueryBuilder(DonationOpportunity, 'opp')
        .where(
          'EXISTS (SELECT 1 FROM donations d WHERE d."opportunityId" = opp.id AND d."donorId" = :donorId)',
          { donorId },
        );

      // Personalized contribution subquery
      qb.addSelect((subQuery) => {
        return subQuery
          .select('SUM(CAST(sd."amountMinor" AS BIGINT))', 'sum')
          .from('donations', 'sd')
          .where('sd."opportunityId" = opp.id')
          .andWhere('sd."donorId" = :donorId', { donorId });
      }, 'myContribution');

      // Subquery for Allocated funds (milestone.status = 'disbursed')
      qb.addSelect((subQuery) => {
        return subQuery
          .select('SUM(CAST(ad."amountMinor" AS BIGINT))', 'sum')
          .from('donations', 'ad')
          .innerJoin('milestones', 'm', 'm.id = ad."milestoneId"')
          .where('ad."opportunityId" = opp.id')
          .andWhere('ad."donorId" = :donorId', { donorId })
          .andWhere('m.status = :allocatedStatus', {
            allocatedStatus: MilestoneStatus.DISBURSED,
          });
      }, 'myAllocatedFunds');

      // Search logic (reused from project pattern)
      const trimmedSearch = search?.trim();
      if (trimmedSearch) {
        qb.andWhere(
          '(opp.title ILIKE :search OR opp.description ILIKE :search)',
          { search: `%${trimmedSearch}%` },
        );
      }

      // Optimization: Add order by most recent donation activity
      qb.addSelect(
        '(SELECT MAX("donatedAt") FROM donations WHERE "opportunityId" = opp.id AND "donorId" = :donorId)',
        'lastDonatedAt',
      ).orderBy('"lastDonatedAt"', 'DESC');

      // 1. Get total count for pagination
      const totalCount = await qb.getCount();

      // 2. Get combined grand totals in a single optimized query
      const grandTotals = await this.donationsRepo
        .createQueryBuilder('d')
        .leftJoin('milestones', 'm', 'm.id = d."milestoneId"')
        .select('SUM(CAST(d."amountMinor" AS BIGINT))', 'totalDonated')
        .addSelect(
          `SUM(CASE WHEN m.status = :status THEN CAST(d."amountMinor" AS BIGINT) ELSE 0 END)`,
          'totalAllocated',
        )
        .where('d."donorId" = :donorId', { donorId })
        .setParameter('status', MilestoneStatus.DISBURSED)
        .getRawOne();

      // 3. Get the paginated entities and their raw impact data
      const { entities, raw } = await qb
        .skip(skip)
        .take(limit)
        .getRawAndEntities();

      const data = entities.map((entity, index) => ({
        ...entity,
        myContribution: raw[index].myContribution || '0',
        myAllocatedFunds: raw[index].myAllocatedFunds || '0',
      }));

      return new CommonResponse(
        200,
        {
          data,
          page,
          limit,
          total: totalCount,
          totalDonationMade: grandTotals?.totalDonated || '0',
          totalFundsAllocated: grandTotals?.totalAllocated || '0',
        },
        'My donated opportunities retrieved',
      );
    } catch (error) {
      this.logger.error(
        `Failed to retrieve donated opportunities for donor ${donorId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        'Unable to retrieve donation history. Please try again later.',
      );
    }
  }
}
