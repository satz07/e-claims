import { DataSourceOptions } from 'typeorm';
import { config as dotenvConfig } from 'dotenv';
import { registerAs } from '@nestjs/config';

dotenvConfig({ path: '.env' });
const isProduction = process.env.NODE_ENV === 'production';

export const config: DataSourceOptions = {
  type: 'postgres',
  host: `${process.env.POSTGRES_HOST}`,
  port: Number(process.env.POSTGRES_PORT),
  username: `${process.env.POSTGRES_USER}`,
  password: `${process.env.POSTGRES_PASSWORD}`,
  database: `${process.env.POSTGRES_DB}`,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  entities: [`${__dirname}/entities/*.js`],
  migrationsTableName: 'typeorm_migrations',
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  synchronize: false,
  migrationsRun: false,
  logging: true,
};

export default registerAs('typeorm', () => config);
