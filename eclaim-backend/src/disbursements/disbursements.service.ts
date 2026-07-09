import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Disbursement,
  DisbursementStatus,
} from '../database/entities/disbursement.entity';
import { Donations } from '../database/entities/donations.entity';
import { DonationStep } from '../database/entities/donation.enums';
import {
  Milestone,
  MilestoneStatus,
} from '../database/entities/milestone.entity';
import { DonationOpportunity } from '../database/entities/donation-opportunity.entity';
import { OpportunityApprovalStatus } from '../database/entities/enums';
import { User, Role } from '../database/entities/users.entity';
import { WalletService } from '../wallet/wallet.service';
import { SharedTransferHistoryDbService } from '../SharedService/transfer-history.shared.service';
import {
  PaymentProvider,
  PaymentMethod,
  TransferDirection,
  TransferType,
  TransferStatus,
} from '../SharedService/dto/transfer-history.dto';
import { CommonResponse } from '../common/common-response';
import { assertMilestoneTransition } from './milestone.state-machine';
import { SubmitProofDto, RejectProofDto } from './dto/submit-proof.dto';

@Injectable()
export class DisbursementsService {
  private readonly logger = new Logger(DisbursementsService.name);

  constructor(
    @InjectRepository(Disbursement)
    private readonly disbursementRepo: Repository<Disbursement>,
    @InjectRepository(Donations)
    private readonly donationsRepo: Repository<Donations>,
    @InjectRepository(Milestone)
    private readonly milestoneRepo: Repository<Milestone>,
    @InjectRepository(DonationOpportunity)
    private readonly opportunityRepo: Repository<DonationOpportunity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly walletService: WalletService,
    private readonly transferHistoryService: SharedTransferHistoryDbService,
    private readonly dataSource: DataSource,
  ) {}

  // ================================================================
  // Milestone helpers
  // ================================================================

  private async getMilestoneOrFail(milestoneId: number): Promise<Milestone> {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
    });
    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found`);
    }
    return milestone;
  }

  // ================================================================
  // Business User: Submit Proof
  // ================================================================

  async submitProof(
    milestoneId: number,
    dto: SubmitProofDto,
    submittedByUserId: number,
  ) {
    const milestone = await this.getMilestoneOrFail(milestoneId);

    // 1. If milestone is in 'pending' state and is the 1st milestone of 1st beneficiary
    // auto-transition to 'in_progress' before 'proof_submitted'
    if (milestone.status === MilestoneStatus.PENDING) {
      const firstMilestone = await this.dataSource
        .createQueryBuilder()
        .select('m.id', 'id')
        .from('milestones', 'm')
        .innerJoin('beneficiaries', 'b', 'b.id = m."beneficiaryId"')
        .where(
          'b."projectPlanId" = (SELECT "projectPlanId" FROM beneficiaries WHERE id = :bid)',
          { bid: milestone.beneficiaryId },
        )
        .orderBy('b.id', 'ASC')
        .addOrderBy('m.id', 'ASC')
        .limit(1)
        .getRawOne();

      if (firstMilestone && firstMilestone.id === milestone.id) {
        milestone.status = MilestoneStatus.IN_PROGRESS;
      }
    }

    assertMilestoneTransition(
      milestone.status,
      MilestoneStatus.PROOF_SUBMITTED,
    );

    milestone.proofDocuments = dto.documents.map((d) => ({
      url: d.url,
      label: d.label,
      submittedAt: new Date().toISOString(),
    }));
    milestone.proofSubmittedAt = new Date();
    milestone.proofSubmittedBy = submittedByUserId;
    milestone.proofRejectionReason = null;
    milestone.status = MilestoneStatus.PROOF_SUBMITTED;

    await this.milestoneRepo.save(milestone);
    return new CommonResponse(200, milestone, 'Proof submitted successfully');
  }

  // ================================================================
  // Admin: Reject Proof
  // ================================================================

  async rejectProof(milestoneId: number, dto: RejectProofDto, adminId: number) {
    const milestone = await this.getMilestoneOrFail(milestoneId);

    assertMilestoneTransition(milestone.status, MilestoneStatus.PROOF_REJECTED);

    milestone.status = MilestoneStatus.PROOF_REJECTED;
    milestone.proofRejectionReason = dto.reason;

    await this.milestoneRepo.save(milestone);
    return new CommonResponse(200, milestone, 'Proof rejected');
  }

  // ================================================================
  // Admin: Approve Proof → mark Milestone COMPLETED
  // ================================================================

  async approveProof(milestoneId: number, adminId: number) {
    const milestone = await this.getMilestoneOrFail(milestoneId);

    assertMilestoneTransition(milestone.status, MilestoneStatus.COMPLETED);

    milestone.status = MilestoneStatus.COMPLETED;
    milestone.proofRejectionReason = null;

    await this.milestoneRepo.save(milestone);
    return new CommonResponse(
      200,
      milestone,
      'Milestone proof approved — ready for disbursement',
    );
  }

  // ================================================================
  // Admin: Disburse Milestone — the core method
  // ================================================================

  async disburseMilestone(milestoneId: number, adminId: number) {
    const milestone = await this.getMilestoneOrFail(milestoneId);

    // 1. Validate milestone is COMPLETED (proof approved, not yet disbursed)
    if (milestone.status !== MilestoneStatus.COMPLETED) {
      throw new BadRequestException(
        `Milestone must be COMPLETED before disbursement. Current status: ${milestone.status}`,
      );
    }

    // 2. Resolve Admin (master wallet sender)
    const admin = await this.userRepo.findOne({
      where: { role: Role.ADMIN },
      relations: ['wallet'],
    });
    if (!admin?.wallet?.walletId) {
      throw new BadRequestException('Admin wallet not found');
    }

    // Resolve admin KYC ID for transfer_history
    // UserKyc is linked via wallet.kyc_id — resolve by querying the admin's wallet
    const adminKycRaw = await this.dataSource
      .createQueryBuilder()
      .select('uk.id', 'id')
      .from('wallets', 'w')
      .innerJoin('user_kyc', 'uk', 'uk.id = w."kycId"')
      .where('w."walletId" = :walletId', { walletId: admin.wallet.walletId })
      .getRawOne();
    const adminKycId: number | undefined = adminKycRaw?.id;

    // 3. Resolve Business (recipient) via Beneficiary → ProjectPlan → Opportunity → implementationPartner
    const beneficiary = await this.dataSource
      .createQueryBuilder()
      .select(['b.*', 'pp.opportunityId'])
      .from('beneficiaries', 'b')
      .innerJoin('project_plans', 'pp', 'pp.id = b."projectPlanId"')
      .where('b.id = :beneficiaryId', {
        beneficiaryId: milestone.beneficiaryId,
      })
      .getRawOne();

    if (!beneficiary) {
      throw new BadRequestException('Beneficiary not found for this milestone');
    }

    const opportunity = await this.opportunityRepo.findOne({
      where: { id: beneficiary.opportunityId },
    });

    if (!opportunity) {
      throw new BadRequestException('Donation opportunity not found');
    }

    if (!opportunity.implementationPartnerId) {
      throw new BadRequestException(
        'Opportunity has no implementation partner (business user)',
      );
    }

    const businessUser = await this.userRepo.findOne({
      where: { id: opportunity.implementationPartnerId },
      relations: ['wallet'],
    });

    if (!businessUser?.wallet?.address) {
      throw new BadRequestException('Business user wallet address not found');
    }

    // 4. Aggregate all TRANSFERRED donations for this milestone
    const donationsToDisburse = await this.donationsRepo.find({
      where: {
        milestoneId,
        donationStep: DonationStep.TRANSFERRED,
      },
    });

    if (donationsToDisburse.length === 0) {
      throw new BadRequestException(
        `No TRANSFERRED donations found for milestone ${milestoneId}`,
      );
    }

    const totalAmountMinor = donationsToDisburse
      .reduce((sum, d) => sum + BigInt(d.amountMinor), 0n)
      .toString();

    const currency = donationsToDisburse[0].currency;

    // 5. Verify admin wallet has the asset + sufficient balance
    const adminAsset = await this.walletService.findWalletAsset(
      admin.wallet.walletId,
      currency,
    );

    const adminBalance = Number(adminAsset.balance ?? 0);
    const totalAmount =
      Number(totalAmountMinor) / Math.pow(10, adminAsset.decimals);

    if (adminBalance < totalAmount) {
      throw new BadRequestException(
        `Admin wallet has insufficient ${currency} balance. Has: ${adminBalance}, needs: ${totalAmount}`,
      );
    }

    // 6. Pre-create Disbursement record (PENDING — before DFNS call)
    const disbursement = this.disbursementRepo.create({
      opportunityId: opportunity.id,
      milestoneId,
      disbursedBy: adminId,
      totalAmountMinor,
      currency,
      currencyDecimals: adminAsset.decimals,
      recipientWalletId: businessUser.wallet.walletId,
      recipientWalletAddress: businessUser.wallet.address,
      status: DisbursementStatus.PENDING,
      donationCount: donationsToDisburse.length,
      occurredAt: new Date(),
    });
    const savedDisbursement = await this.disbursementRepo.save(disbursement);

    // 7. Pre-create transfer_history record (INITIATED)
    const tempReference = `dfns-disburse-milestone-${milestoneId}-${Date.now()}`;
    let historyRecord: any;
    try {
      historyRecord = await this.transferHistoryService.upsertTransferHistory({
        userId: String(admin.id),
        kycId: adminKycId,
        provider: PaymentProvider.DFNS,
        paymentMethod: PaymentMethod.DFNS_CRYPTO_TRANSFER,
        direction: TransferDirection.OUT,
        type: TransferType.BANK_TRANSFER,
        status: TransferStatus.INITIATED,
        amountMinor: totalAmountMinor,
        currency,
        currencyDecimals: adminAsset.decimals,
        occurredAt: new Date(),
        providerReference: tempReference,
        internalReference: `disbursement-${savedDisbursement.id}`,
      });
    } catch (histErr) {
      this.logger.warn(
        `Could not create transfer_history record for disbursement ${savedDisbursement.id}`,
        histErr,
      );
    }

    // 8. Execute DFNS transfer — admin master wallet → business wallet
    let transferResult: any;
    try {
      transferResult = await this.walletService.sendAsset(
        {
          payload: {
            asset: {
              kind: 'Erc20',
              symbol: adminAsset.symbol,
              decimals: adminAsset.decimals,
              contract: adminAsset.contract,
            },
            destination: { address: businessUser.wallet.address },
            humanAmount: totalAmount.toString(),
          },
        } as any,
        admin.wallet.walletId,
      );
    } catch (err) {
      const failureReason =
        err instanceof Error ? err.message : 'DFNS transfer failed';

      // Update Disbursement to FAILED
      await this.disbursementRepo.update(savedDisbursement.id, {
        status: DisbursementStatus.FAILED,
        failureReason,
      });

      // Update transfer_history to FAILED
      if (historyRecord) {
        await this.transferHistoryService.upsertTransferHistory({
          userId: String(admin.id),
          kycId: adminKycId,
          provider: PaymentProvider.DFNS,
          paymentMethod: PaymentMethod.DFNS_CRYPTO_TRANSFER,
          direction: TransferDirection.OUT,
          type: TransferType.BANK_TRANSFER,
          status: TransferStatus.FAILED,
          amountMinor: totalAmountMinor,
          currency,
          occurredAt: new Date(),
          providerReference: tempReference,
          failureReason,
        });
      }

      this.logger.error(
        `Disbursement ${savedDisbursement.id} FAILED: ${failureReason}`,
      );
      throw err;
    }

    const dfnsTransactionId = (transferResult as any)?.id ?? null;
    const finalReference = dfnsTransactionId ?? tempReference;

    // 9. Update Disbursement to SUCCESS
    await this.disbursementRepo.update(savedDisbursement.id, {
      status: DisbursementStatus.SUCCESS,
      dfnsTransactionId,
      dfnsPayload: transferResult,
    });

    // Update transfer_history to SUCCESS
    if (historyRecord) {
      await this.transferHistoryService.upsertTransferHistory({
        userId: String(admin.id),
        kycId: adminKycId,
        provider: PaymentProvider.DFNS,
        paymentMethod: PaymentMethod.DFNS_CRYPTO_TRANSFER,
        direction: TransferDirection.OUT,
        type: TransferType.BANK_TRANSFER,
        status: TransferStatus.SUCCESS,
        amountMinor: totalAmountMinor,
        currency,
        occurredAt: new Date(),
        providerReference: finalReference,
        providerPayload: transferResult,
      });
    }

    // 10. Batch update all included donations to DISBURSED
    await this.donationsRepo
      .createQueryBuilder()
      .update(Donations)
      .set({
        donationStep: DonationStep.DISBURSED,
        disbursementId: savedDisbursement.id,
      })
      .where('id IN (:...ids)', { ids: donationsToDisburse.map((d) => d.id) })
      .execute();

    // 11. Update Milestone to DISBURSED
    await this.milestoneRepo.update(milestoneId, {
      status: MilestoneStatus.DISBURSED,
      disbursementId: savedDisbursement.id,
      disbursedAt: new Date(),
      disbursedBy: adminId,
    });

    this.logger.log(
      `Milestone ${milestoneId} disbursed: ${donationsToDisburse.length} donations, ` +
        `total ${totalAmount} ${currency}, DFNS tx: ${dfnsTransactionId}`,
    );

    return new CommonResponse(
      200,
      {
        disbursementId: savedDisbursement.id,
        dfnsTransactionId,
        totalAmount,
        currency,
        donationCount: donationsToDisburse.length,
        recipientAddress: businessUser.wallet.address,
      },
      'Milestone disbursed successfully',
    );
  }

  // ================================================================
  // Admin: Complete Opportunity (all milestones disbursed)
  // ================================================================

  async completeOpportunity(opportunityId: number, adminId: number) {
    const opportunity = await this.opportunityRepo.findOne({
      where: { id: opportunityId },
    });
    if (!opportunity) {
      throw new NotFoundException(`Opportunity ${opportunityId} not found`);
    }

    // Find all milestones for this opportunity via beneficiary chain
    const milestones = await this.dataSource
      .createQueryBuilder()
      .select('m.*')
      .from('milestones', 'm')
      .innerJoin('beneficiaries', 'b', 'b.id = m."beneficiaryId"')
      .innerJoin('project_plans', 'pp', 'pp.id = b."projectPlanId"')
      .where('pp."opportunityId" = :opportunityId', { opportunityId })
      .getRawMany();

    const allDisbursed = milestones.every(
      (m) => m.status === MilestoneStatus.DISBURSED,
    );

    if (!allDisbursed) {
      const pending = milestones
        .filter((m) => m.status !== MilestoneStatus.DISBURSED)
        .map((m) => `#${m.id} (${m.status})`)
        .join(', ');

      throw new BadRequestException(
        `Cannot complete opportunity — milestones not yet disbursed: ${pending}`,
      );
    }

    await this.opportunityRepo.update(opportunityId, {
      status: OpportunityApprovalStatus.COMPLETED,
    });

    return new CommonResponse(
      200,
      { opportunityId },
      'Opportunity marked as completed',
    );
  }

  // ================================================================
  // Queries
  // ================================================================

  async getDisbursement(id: number) {
    const disbursement = await this.disbursementRepo.findOne({
      where: { id },
      relations: ['milestone', 'opportunity'],
    });
    if (!disbursement) {
      throw new NotFoundException(`Disbursement ${id} not found`);
    }
    return new CommonResponse(200, disbursement, 'Disbursement retrieved');
  }

  async listDisbursementsForMilestone(milestoneId: number) {
    const records = await this.disbursementRepo.find({
      where: { milestoneId },
    });
    return new CommonResponse(200, records, 'Disbursements retrieved');
  }
}
