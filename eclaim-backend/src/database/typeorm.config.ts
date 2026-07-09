import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from './database.source';

export default new DataSource(config as DataSourceOptions);
