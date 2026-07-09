import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PaginationDto } from 'src/SharedService/dto/pagination.dto';

@Injectable()
export class SharedBatchService {
  private readonly manufacturerUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    const raw =
      this.config.get<string>('appendpoints.backend.manufacturerUrl') || '';
    // normalize to end with a single slash
    this.manufacturerUrl = raw.replace(/\/+$/, '') + '/';
  }

  private bearer(token: string): string {
    return token?.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  async getAllBatches<T = any>(
    token: string,
    pagination: PaginationDto,
  ): Promise<T> {
    const url = `${this.manufacturerUrl}api/batches/all-batches`;
    try {
      const { data } = await firstValueFrom(
        this.http.get<T>(url, {
          headers: { Authorization: this.bearer(token) },
          params: {
            page: pagination.page ?? 1,
            limit: pagination.limit ?? 10,
          },
        }),
      );
      return data;
    } catch (error: any) {
      console.error(
        'Error fetching all batches:',
        error?.response?.data || error,
      );
      throw new Error('Failed to fetch batches from manufacturer service');
    }
  }

  async getBatchById<T = any>(token: string, id: number): Promise<T> {
    const url = `${this.manufacturerUrl}api/batches/${id}`;
    try {
      const { data } = await firstValueFrom(
        this.http.get<T>(url, {
          headers: { Authorization: this.bearer(token) },
        }),
      );
      return data;
    } catch (error: any) {
      console.error(
        'Error fetching batch by id:',
        error?.response?.data || error,
      );
      throw new Error('Failed to fetch batch from manufacturer service');
    }
  }
  async getMyBatchesByBatchno<T = any>(
    token: string,
    batchno: string,
    pagination?: PaginationDto,
  ): Promise<T> {
    const url = `${this.manufacturerUrl}api/batches/me/get-all`;
    try {
      const { data } = await firstValueFrom(
        this.http.get<T>(url, {
          headers: { Authorization: this.bearer(token) },
          params: {
            batchno,
            page: pagination?.page ?? 1,
            limit: pagination?.limit ?? 10,
          },
        }),
      );
      return data;
    } catch (error: any) {
      console.error(
        'Error fetching my batches by batchno:',
        error?.response?.data || error,
      );
      throw new Error(
        'Failed to fetch batches by batchno from manufacturer service',
      );
    }
  }

  async getChildBatchesByEventId<T = any>(
    token: string,
    baseUrl: string,
    eventid: string,
  ): Promise<T> {
    const url = `${baseUrl}api/batches/me/get-all`;
    try {
      const { data } = await firstValueFrom(
        this.http.get<T>(url, {
          headers: { Authorization: this.bearer(token) },
          params: {
            parenteventId: eventid,
          },
        }),
      );
      return data;
    } catch (error: any) {
      console.error(
        'Error fetching my batches by batchno:',
        error?.response?.data || error,
      );
      throw new Error(
        'Failed to fetch batches by batchno from manufacturer service',
      );
    }
  }

  async patchEnableDisable(url: string, token: string, isEnabled: boolean) {
    try {
      return await firstValueFrom(
        this.http.patch(
          url,
          { isEnabled },
          { headers: { Authorization: this.bearer(token) } },
        ),
      );
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message ?? err?.message ?? '';
      if (status === 404 || /batch\s*not\s*found/i.test(msg)) {
        // skip silently as you do
        console.warn(`Skip ${url}: ${msg}`);
        return null;
      }
      throw err; // propagate other errors
    }
  }
}
