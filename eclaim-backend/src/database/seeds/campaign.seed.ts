import { DataSource, DataSourceOptions } from 'typeorm';
import { Campaign } from '../entities/campaign.entity';
import { config } from '../database.source';
import * as fs from 'fs';
import * as path from 'path';

async function seed() {
  console.log('Initializing data source...');
  const dataSource = new DataSource({
    ...config,
    entities: [Campaign],
    logging: false,
  } as DataSourceOptions);
  await dataSource.initialize();

  const campaignRepository = dataSource.getRepository(Campaign);

  const seedDataPath = path.join(process.cwd(), 'seedCampaign.json');
  console.log(`Reading seed data from: ${seedDataPath}`);

  if (!fs.existsSync(seedDataPath)) {
    throw new Error(`Seed data file not found at ${seedDataPath}`);
  }

  const seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));

  console.log(`Checking existing campaigns...`);
  const existingCampaigns = await campaignRepository.find({
    select: ['refCode'],
  });
  const existingRefCodes = new Set(existingCampaigns.map((c) => c.refCode));

  const newCampaignData = seedData.filter(
    (data: any) => !existingRefCodes.has(data.refCode),
  );

  if (newCampaignData.length === 0) {
    console.log('No new campaigns to seed. Everything is up to date.');
  } else {
    console.log(`Seeding ${newCampaignData.length} new campaigns...`);
    const campaigns = newCampaignData.map((data: any) =>
      campaignRepository.create(data),
    );
    await campaignRepository.save(campaigns);
    console.log('Seeding completed successfully!');
  }

  await dataSource.destroy();
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
