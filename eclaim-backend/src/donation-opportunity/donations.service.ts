import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Donations } from '../database/entities/donations.entity';
import { ListDonationsQueryDto } from './dto/donations.dto';

@Injectable()
export class DonationsService {
  constructor(
    @InjectRepository(Donations)
    private readonly donationsRepo: Repository<Donations>,
  ) {}

  async findAll(query: ListDonationsQueryDto) {
    const { page = 1, limit = 10, ...filters } = query;
    const skip = (page - 1) * limit;

    const qb = this.donationsRepo
      .createQueryBuilder('donation')
      .leftJoinAndSelect('donation.opportunity', 'opportunity')
      .leftJoinAndSelect('donation.campaign', 'campaign');

    // Apply dynamic filters for all ID fields and status
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        qb.andWhere(`donation.${key} = :${key}`, { [key]: value });
      }
    });

    const [data, total] = await qb
      .orderBy('donation.donatedAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
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

    return donation;
  }
}
