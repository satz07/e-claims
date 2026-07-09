import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserIbanDto } from './dto/create-user-iban.dto';
import { UserIban } from 'src/database/entities/dfns-user-iban.entity';
import { UserKyc } from 'src/database/entities/user-kyc.entity';
import { PaginationDto } from './dto/pagination.dto';
import { JwtService } from '@nestjs/jwt';
import { CustomRequest } from 'src/types/Request';

@Injectable()
export class UserIbanService {
  constructor(
    @InjectRepository(UserIban)
    private readonly userIbanRepo: Repository<UserIban>,
    @InjectRepository(UserKyc)
    private readonly userKycRepo: Repository<UserKyc>,
    private readonly jwtService: JwtService,
  ) {}

  async create(dto: CreateUserIbanDto, req: CustomRequest) {
    const { userId, email } = req.user;

    if (!userId || !email) {
      throw new BadRequestException(
        'Provide either userId (us-...) or token (DSSC end-user JWT)',
      );
    }

    // ✅ Find KYC record for this email
    const kyc = await this.userKycRepo.findOne({ where: { email } });
    if (!kyc) {
      throw new BadRequestException('KYC record not found for this email');
    }

    // ✅ Check IBAN uniqueness per user
    const exists = await this.userIbanRepo.findOne({
      where: {
        userId,
        walletAddress: dto.walletAddress,
      },
    });
    if (exists) {
      throw new BadRequestException('This wallet address is already added');
    }

    // ✅ Create IBAN linked to KYC
    const iban = this.userIbanRepo.create({
      userId,
      kycId: kyc.id, // link IBAN to KYC
      accountName: dto.accountName,
      walletAddress: dto.walletAddress,
      nickname: dto.nickname,
    });

    return this.userIbanRepo.save(iban);
  }

  async findByUser(req: CustomRequest, pageDto: PaginationDto) {
    const { userId } = req.user;
    if (!userId) {
      throw new BadRequestException('Provide either userId (us-...)');
    }

    const page = pageDto.page || 1;
    const limit = pageDto.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.userIbanRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteById(req: CustomRequest, ibanId: number) {
    const { userId } = req.user;
    if (!userId) throw new BadRequestException('Invalid user context');
    if (!ibanId) throw new BadRequestException('ibanId is required');

    // Ensure ownership (userId scope)
    const iban = await this.userIbanRepo.findOne({
      where: { id: ibanId, userId },
    });

    if (!iban) {
      throw new NotFoundException('IBAN not found for this user');
    }

    await this.userIbanRepo.delete({ id: iban.id as any, userId });

    return {
      success: true,
      message: 'IBAN deleted successfully',
      deletedId: iban.id,
    };
  }
}
