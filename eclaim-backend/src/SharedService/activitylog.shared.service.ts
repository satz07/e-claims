// src/common/services/notification.service.ts
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class SharedActivityLogService {
  private readonly notificationUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.notificationUrl = this.configService.get<string>(
      'appendpoints.backend.notificationUrl',
    );
  }

  async createUserActivityLog<T = any>(
    data: any,
    token?: string,
  ): Promise<T | void> {
    try {
      const response = await lastValueFrom(
        this.httpService.post(
          this.notificationUrl,
          { userDetails: data },
          {
            headers: {
              Authorization: token ? `Bearer ${token}` : '',
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      return response.data;
    } catch (error) {
      console.error(
        'Create User Activity Log POST error:',
        error?.response?.data || error,
      );
    }
  }
}
