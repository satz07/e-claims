import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

export interface ClaimDbProviderRow {
  fid_code: string;
  provider_name: string;
  provider_level: string | null;
  county: string | null;
  facility_level: string | null;
}

@Injectable()
export class ClaimDbService {
  private pool: Pool | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.CLAIM_DB_PASSWORD);
  }

  private getPool(): Pool {
    if (!this.pool) {
      this.pool = new Pool({
        host: process.env.CLAIM_DB_HOST || '10.10.100.113',
        port: Number(process.env.CLAIM_DB_PORT || 5432),
        user: process.env.CLAIM_DB_USER || 'netgroup',
        password: process.env.CLAIM_DB_PASSWORD || '',
        database: process.env.CLAIM_DB_NAME || 'claim',
        ssl:
          process.env.CLAIM_DB_SSL === 'false'
            ? false
            : {
                rejectUnauthorized:
                  process.env.CLAIM_DB_SSL_REJECT_UNAUTHORIZED === 'true',
              },
      });
    }
    return this.pool;
  }

  async getProviderByFid(fid: string): Promise<ClaimDbProviderRow | null> {
    if (!this.isConfigured() || !fid) return null;
    const res = await this.getPool().query<ClaimDbProviderRow>(
      `
        SELECT
          pr.fid_code,
          pr.name AS provider_name,
          pr.level AS provider_level,
          pr.county,
          pr.level AS facility_level
        FROM provider pr
        WHERE pr.fid_code = $1
          AND pr.fid_code IS NOT NULL
          AND pr.fid_code <> ''
        ORDER BY pr.id
        LIMIT 1
      `,
      [fid],
    );
    return res.rows[0] ?? null;
  }

  async getCitizenByCrId(crId: string): Promise<{ cr_id: string } | null> {
    if (!this.isConfigured() || !crId) return null;
    const res = await this.getPool().query<{ cr_id: string }>(
      `SELECT cr_id FROM patient WHERE cr_id = $1 LIMIT 1`,
      [crId],
    );
    return res.rows[0] ?? null;
  }

  async getSchemeByCode(schemeCode: string): Promise<{ scheme_code: string } | null> {
    if (!this.isConfigured() || !schemeCode) return null;
    const res = await this.getPool().query<{ scheme_code: string }>(
      `
        SELECT coverage_type AS scheme_code
        FROM claim_attributes
        WHERE coverage_type = $1
          AND status = 'ACTIVE'
          AND coverage_type IS NOT NULL
          AND coverage_type <> ''
        LIMIT 1
      `,
      [schemeCode],
    );
    return res.rows[0] ?? null;
  }
}
