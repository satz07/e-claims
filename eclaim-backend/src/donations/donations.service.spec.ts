import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DonationsService } from './donations.service';
import { Donations } from '../database/entities/donations.entity';
import {
  DonationStep,
  DonationPaymentSource,
} from '../database/entities/donation.enums';
import { User, Role } from '../database/entities/users.entity';
import { WalletService } from '../wallet/wallet.service';

describe('DonationsService', () => {
  let service: DonationsService;
  let donationsRepo: any;
  let userRepo: any;
  let walletService: any;

  const mockDonation = (overrides: Partial<Donations> = {}): Donations =>
    ({
      id: 1,
      donorId: 10,
      walletId: 'wallet-10',
      transactionId: null,
      campaignId: null,
      opportunityId: 1,
      beneficiaryId: null,
      milestoneId: null,
      amountMinor: '100000',
      currency: 'USDC',
      paymentSource: DonationPaymentSource.WALLET,
      donationStep: DonationStep.INITIATED,
      disbursementId: null,
      failureReason: null,
      stepHistory: [
        {
          fromStep: null,
          toStep: DonationStep.INITIATED,
          at: new Date().toISOString(),
          triggeredBy: 10,
        },
      ],
      metadata: null,
      donatedAt: new Date(),
      donor: null as any,
      campaign: null as any,
      opportunity: null as any,
      beneficiary: null as any,
      milestone: null as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Donations;

  beforeEach(async () => {
    donationsRepo = {
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((entity) =>
        Promise.resolve({ ...entity, id: entity.id ?? 1 }),
      ),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
    };

    userRepo = {
      findOne: jest.fn(),
      manager: {
        findOne: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        })),
      },
    };

    walletService = {
      sendAsset: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationsService,
        {
          provide: getRepositoryToken(Donations),
          useValue: donationsRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepo,
        },
        {
          provide: WalletService,
          useValue: walletService,
        },
      ],
    }).compile();

    service = module.get<DonationsService>(DonationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ================================================================
  // Create
  // ================================================================
  describe('create', () => {
    it('should create a donation at INITIATED step', async () => {
      const dto = {
        opportunityId: 1,
        amountMinor: '100000',
        currency: 'USDC',
        paymentSource: DonationPaymentSource.WALLET,
        walletId: 'wallet-10',
      };

      const result = await service.create(dto, 10);

      expect(result.statusCode).toBe(201);
      expect(result.data.donationStep).toBe(DonationStep.INITIATED);
      expect(result.data.stepHistory).toHaveLength(1);
      expect(result.data.stepHistory[0].toStep).toBe(DonationStep.INITIATED);
      expect(donationsRepo.create).toHaveBeenCalled();
      expect(donationsRepo.save).toHaveBeenCalled();
    });
  });

  // ================================================================
  // Donate Request
  // ================================================================
  describe('donateRequest', () => {
    const mockUser = {
      id: 10,
      wallet: { walletId: 'donor-wallet-1' },
    };
    const mockDto = {
      payload: {
        opportunityId: '1',
        Amount: '50000',
        asset: { symbol: 'USDC' },
      },
    };

    it('should throw if user does not have a wallet', async () => {
      const userWithoutWallet = { id: 10 };
      await expect(
        service.donateRequest(mockDto as any, userWithoutWallet as any),
      ).rejects.toThrow('User does not have a wallet to donate from');
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('should throw if no admin wallet is found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.donateRequest(mockDto as any, mockUser as any),
      ).rejects.toThrow(BadRequestException);
      expect(walletService.sendAsset).not.toHaveBeenCalled();
    });

    it('should throw if opportunityId is invalid (NaN)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 1,
        wallet: { address: 'admin-address', walletId: 'admin-wallet-1' },
      });
      const dtoWithInvalidOpportunity = {
        payload: { opportunityId: 'not-a-number', Amount: '50000' },
      };
      await expect(
        service.donateRequest(
          dtoWithInvalidOpportunity as any,
          mockUser as any,
        ),
      ).rejects.toThrow('Invalid opportunityId provided');
      expect(walletService.sendAsset).not.toHaveBeenCalled();
    });

    it('should throw if opportunity is not found', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 1,
        wallet: { address: 'admin-address', walletId: 'admin-wallet-1' },
      });
      userRepo.manager.findOne.mockResolvedValue(null);

      await expect(
        service.donateRequest(mockDto as any, mockUser as any),
      ).rejects.toThrow('Donation Opportunity not found');
    });

    it('should successfully execute a donate request and transition to TRANSFERRED', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 1,
        wallet: { address: 'admin-address', walletId: 'admin-wallet-1' },
      });
      userRepo.manager.findOne
        .mockResolvedValueOnce({ id: 1, campaignId: 2 }) // Opportunity
        .mockResolvedValueOnce({ id: 3 }) // ProjectPlan
        .mockResolvedValueOnce({ id: 4 }); // Beneficiary

      walletService.sendAsset.mockResolvedValue({
        id: 'dfns-tx-123',
        status: 'Confirmed',
      });

      jest
        .spyOn(service, 'create')
        .mockResolvedValue({
          statusCode: 201,
          data: { id: 99, stepHistory: [] },
        } as any);
      donationsRepo.findOne.mockResolvedValue({ id: 99, stepHistory: [] });
      donationsRepo.save.mockResolvedValue({
        id: 99,
        transactionId: 'dfns-tx-123',
      });

      const result = await service.donateRequest(
        mockDto as any,
        mockUser as any,
      );

      expect(result.statusCode).toBe(200);
      expect(result.data.donationId).toBe(99);
      expect(result.data.transfer.id).toBe('dfns-tx-123');
      expect(walletService.sendAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            destination: { address: 'admin-address' },
          }),
        }),
        'donor-wallet-1',
      );
    });

    it('should transition donation to FAILED if DFNS throws', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 1,
        wallet: { address: 'admin-address', walletId: 'admin-wallet-1' },
      });
      userRepo.manager.findOne.mockResolvedValue({ id: 1, campaignId: 2 });

      walletService.sendAsset.mockRejectedValue(new Error('DFNS timeout'));

      jest
        .spyOn(service, 'create')
        .mockResolvedValue({
          statusCode: 201,
          data: {
            id: 99,
            stepHistory: [],
            donationStep: DonationStep.INITIATED,
          },
        } as any);
      jest.spyOn(service, 'applyTransition').mockResolvedValue({} as any);

      await expect(
        service.donateRequest(mockDto as any, mockUser as any),
      ).rejects.toThrow('DFNS timeout');

      expect(service.applyTransition).toHaveBeenCalledWith(
        expect.objectContaining({ id: 99 }),
        DonationStep.FAILED,
        mockUser.id,
        expect.objectContaining({ reason: 'DFNS timeout' }),
      );
    });
  });

  // ================================================================
  // Step Transitions
  // ================================================================
  describe('applyTransition', () => {
    it('should apply INITIATED → TRANSFERRED', async () => {
      const donation = mockDonation();
      donationsRepo.save.mockResolvedValue({
        ...donation,
        donationStep: DonationStep.TRANSFERRED,
      });

      const result = await service.applyTransition(
        donation,
        DonationStep.TRANSFERRED,
        10,
      );
      expect(result.donationStep).toBe(DonationStep.TRANSFERRED);
    });

    it('should reject invalid transitions', async () => {
      const donation = mockDonation({ donationStep: DonationStep.DISBURSED });
      await expect(
        service.applyTransition(donation, DonationStep.TRANSFERRED, 10),
      ).rejects.toThrow(BadRequestException);
    });

    it('should store failure reason when transitioning to FAILED', async () => {
      const donation = mockDonation();
      donationsRepo.save.mockImplementation((d) => Promise.resolve({ ...d }));

      const result = await service.applyTransition(
        donation,
        DonationStep.FAILED,
        10,
        {
          reason: 'Transfer rejected',
        },
      );
      expect(result.donationStep).toBe(DonationStep.FAILED);
      expect(result.failureReason).toBe('Transfer rejected');
    });
  });

  // ================================================================
  // findAll
  // ================================================================
  describe('findAll', () => {
    it('should return paginated donations', async () => {
      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.statusCode).toBe(200);
      expect(result.data).toHaveProperty('data');
      expect(result.data).toHaveProperty('total');
    });
  });

  // ================================================================
  // findOne
  // ================================================================
  describe('findOne', () => {
    it('should return donation with relations', async () => {
      donationsRepo.findOne.mockResolvedValue(mockDonation());
      const result = await service.findOne(1);
      expect(result.statusCode).toBe(200);
      expect(result.data.id).toBe(1);
    });

    it('should throw NotFoundException for missing donation', async () => {
      donationsRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ================================================================
  // Timeline
  // ================================================================

  describe('getTimeline', () => {
    it('should return step history', async () => {
      donationsRepo.findOne.mockResolvedValue(mockDonation());
      const result = await service.getTimeline(1);
      expect(result.statusCode).toBe(200);
      expect(result.data.timeline).toHaveLength(1);
    });
  });
});
