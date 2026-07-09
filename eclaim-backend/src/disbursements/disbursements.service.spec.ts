import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { DisbursementsService } from './disbursements.service';
import {
  Disbursement,
  DisbursementStatus,
} from '../database/entities/disbursement.entity';
import { Donations } from '../database/entities/donations.entity';
import {
  Milestone,
  MilestoneStatus,
} from '../database/entities/milestone.entity';
import { DonationOpportunity } from '../database/entities/donation-opportunity.entity';
import { User } from '../database/entities/users.entity';
import { WalletService } from '../wallet/wallet.service';
import { SharedTransferHistoryDbService } from '../SharedService/transfer-history.shared.service';
import { DonationStep } from '../database/entities/donation.enums';

describe('DisbursementsService', () => {
  let service: DisbursementsService;
  let disbursementRepo: jest.Mocked<Repository<Disbursement>>;
  let milestoneRepo: jest.Mocked<Repository<Milestone>>;
  let opportunityRepo: jest.Mocked<Repository<DonationOpportunity>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let donationsRepo: jest.Mocked<Repository<Donations>>;
  let walletService: jest.Mocked<WalletService>;
  let transferHistoryService: jest.Mocked<SharedTransferHistoryDbService>;
  let dataSource: jest.Mocked<DataSource>;

  const mockAdmin = {
    id: 99,
    role: 'admin',
    wallet: { walletId: 'admin-wallet', address: '0xAdmin' },
  };

  const mockBusinessUser = {
    id: 2,
    role: 'business',
    wallet: { walletId: 'business-wallet', address: '0xBusiness' },
  };

  const mockOpportunity = {
    id: 10,
    implementationPartnerId: 2,
  };

  beforeEach(async () => {
    const mockRepo = () => ({
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest
        .fn()
        .mockImplementation(async (entity) => ({ id: 1, ...entity })),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      }),
    });

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    };

    const mockDataSource = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      manager: {
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisbursementsService,
        { provide: getRepositoryToken(Disbursement), useValue: mockRepo() },
        { provide: getRepositoryToken(Donations), useValue: mockRepo() },
        { provide: getRepositoryToken(Milestone), useValue: mockRepo() },
        {
          provide: getRepositoryToken(DonationOpportunity),
          useValue: mockRepo(),
        },
        { provide: getRepositoryToken(User), useValue: mockRepo() },
        {
          provide: WalletService,
          useValue: {
            findWalletAsset: jest.fn(),
            sendAsset: jest.fn(),
          },
        },
        {
          provide: SharedTransferHistoryDbService,
          useValue: {
            upsertTransferHistory: jest.fn(),
          },
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DisbursementsService>(DisbursementsService);
    disbursementRepo = module.get(getRepositoryToken(Disbursement));
    milestoneRepo = module.get(getRepositoryToken(Milestone));
    opportunityRepo = module.get(getRepositoryToken(DonationOpportunity));
    userRepo = module.get(getRepositoryToken(User));
    donationsRepo = module.get(getRepositoryToken(Donations));
    walletService = module.get(WalletService);
    transferHistoryService = module.get(SharedTransferHistoryDbService);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('submitProof', () => {
    const dto = { documents: [{ url: 'http://doc', label: 'Doc 1' }] };

    it('should throw NotFound if milestone does not exist', async () => {
      milestoneRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.submitProof(1, dto, mockBusinessUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFound if milestone does not exist', async () => {
      milestoneRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.submitProof(1, dto, mockBusinessUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update milestone to proof_submitted', async () => {
      milestoneRepo.findOne.mockResolvedValueOnce({
        id: 1,
        beneficiaryId: 5,
        status: MilestoneStatus.IN_PROGRESS,
      } as any);
      const mockQb = dataSource.createQueryBuilder();
      (mockQb.getRawOne as jest.Mock).mockResolvedValueOnce({
        opportunityId: 10,
      });
      opportunityRepo.findOne.mockResolvedValueOnce(mockOpportunity as any);

      const result = await service.submitProof(1, dto, mockBusinessUser as any);
      expect(result.statusCode).toBe(200);
      expect(milestoneRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: MilestoneStatus.PROOF_SUBMITTED }),
      );
    });
  });

  describe('approveProof', () => {
    it('should update milestone to completed', async () => {
      milestoneRepo.findOne.mockResolvedValueOnce({
        id: 1,
        status: MilestoneStatus.PROOF_SUBMITTED,
      } as any);
      const result = await service.approveProof(1, mockAdmin as any);

      expect(result.statusCode).toBe(200);
      expect(milestoneRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: MilestoneStatus.COMPLETED }),
      );
    });
  });

  describe('disburseMilestone', () => {
    it('should throw if admin wallet not found', async () => {
      milestoneRepo.findOne.mockResolvedValueOnce({
        id: 1,
        status: MilestoneStatus.COMPLETED,
      } as any);
      userRepo.findOne.mockResolvedValueOnce(null); // Admin query returns null
      await expect(
        service.disburseMilestone(1, mockAdmin as any),
      ).rejects.toThrow('Admin wallet not found');
    });

    it('should execute full disbursement flow successfully', async () => {
      milestoneRepo.findOne.mockResolvedValueOnce({
        id: 1,
        status: MilestoneStatus.COMPLETED,
        beneficiaryId: 5,
      } as any);
      userRepo.findOne
        .mockResolvedValueOnce(mockAdmin as any) // 1. Admin query
        .mockResolvedValueOnce(mockBusinessUser as any); // 2. Business user query

      const mockQb = dataSource.createQueryBuilder();
      (mockQb.getRawOne as jest.Mock)
        .mockResolvedValueOnce({ id: 111 }) // adminKyc
        .mockResolvedValueOnce({ opportunityId: 10 }); // beneficiary query

      opportunityRepo.findOne.mockResolvedValueOnce(mockOpportunity as any);

      // Mock Donations to Disburse
      donationsRepo.find.mockResolvedValueOnce([
        {
          id: 101,
          amountMinor: '500',
          currency: 'DDSC',
          donationStep: DonationStep.TRANSFERRED,
        },
        {
          id: 102,
          amountMinor: '500',
          currency: 'DDSC',
          donationStep: DonationStep.TRANSFERRED,
        },
      ] as any);

      walletService.findWalletAsset.mockResolvedValueOnce({
        balance: '10',
        decimals: 2,
      } as any); // 10.00 DDSC available (1000 minor)
      walletService.sendAsset.mockResolvedValueOnce({
        id: 'dfns-tx-123',
        status: 'SUCCESS',
      } as any);
      transferHistoryService.upsertTransferHistory.mockResolvedValue({
        reference: 'ref-1',
      } as any);

      const result = await service.disburseMilestone(1, mockAdmin as any);

      expect(result.statusCode).toBe(200);
      expect(disbursementRepo.save).toHaveBeenCalled();

      // Check DFNS was called with the aggregate amount
      expect(walletService.sendAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ humanAmount: '10' }),
        }),
        'admin-wallet',
      );

      // Check Milestone updated to disbursed
      expect(milestoneRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: MilestoneStatus.DISBURSED }),
      );

      // Check donations were batch updated via QueryBuilder
      const qb: any = donationsRepo.createQueryBuilder();
      expect(qb.update).toHaveBeenCalledWith(Donations);
      expect(qb.set).toHaveBeenCalledWith({
        donationStep: DonationStep.DISBURSED,
        disbursementId: expect.any(Number),
      });
      expect(qb.execute).toHaveBeenCalled();
    });

    it('should throw if no TRANSFERRED donations exist', async () => {
      milestoneRepo.findOne.mockResolvedValueOnce({
        id: 1,
        status: MilestoneStatus.COMPLETED,
        beneficiaryId: 5,
      } as any);
      userRepo.findOne
        .mockResolvedValueOnce(mockAdmin as any)
        .mockResolvedValueOnce(mockBusinessUser as any);

      const mockQb = dataSource.createQueryBuilder();
      (mockQb.getRawOne as jest.Mock)
        .mockResolvedValueOnce({ id: 111 })
        .mockResolvedValueOnce({ opportunityId: 10 });

      opportunityRepo.findOne.mockResolvedValueOnce(mockOpportunity as any);

      // Mock Empty Donations
      donationsRepo.find.mockResolvedValueOnce([]);

      await expect(
        service.disburseMilestone(1, mockAdmin as any),
      ).rejects.toThrow('No TRANSFERRED donations found for milestone 1');
    });
  });
});
