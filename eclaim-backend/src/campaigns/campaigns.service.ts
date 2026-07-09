import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../database/entities/campaign.entity';
import { ListCampaignsQueryDto } from './dto/campaign-query.dto';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
  ) {}

  async findAll(query: ListCampaignsQueryDto) {
    const { page, limit, status, sector, priority } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.campaignRepo.createQueryBuilder('campaign');

    if (status) {
      queryBuilder.andWhere('campaign.status = :status', { status });
    }

    if (sector) {
      queryBuilder.andWhere('campaign.sector = :sector', { sector });
    }

    if (priority) {
      queryBuilder.andWhere('campaign.priority = :priority', { priority });
    }

    const [data, total] = await queryBuilder
      .orderBy('campaign.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: number) {
    return this.campaignRepo.findOne({ where: { id } });
  }
}
