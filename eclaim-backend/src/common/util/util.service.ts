import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { v4 } from 'uuid';

import { AllConfigType } from 'src/config/config.type';

@Injectable()
export class UtilService {
  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  getNumber(key: keyof AllConfigType): number {
    const value = this.configService.get<string>(key);

    try {
      return Number(value);
    } catch {
      throw new Error(key + ' environment variable is not a number');
    }
  }

  getString(key: keyof AllConfigType): string {
    const value = this.configService.get<string>(key, { infer: true });

    return value.replace(/\\n/g, '\n');
  }

  getRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  pick<T extends object, K extends keyof T>(instance: T, keys: K[]) {
    return keys.reduce(
      (picked, key) => {
        if (key in instance) {
          picked[key] = instance[key];
        }

        return picked;
      },
      {} as Pick<T, K>,
    );
  }

  get getRandomUUID() {
    return v4();
  }

  // === Add these two methods ===

  parseJSON(input: any): Record<string, any> {
    if (typeof input === 'string') {
      try {
        return JSON.parse(input);
      } catch (err) {
        console.warn('Failed to parse JSON:', input);
        return {};
      }
    }
    return typeof input === 'object' && !Array.isArray(input) ? input : {};
  }

  parseSelect<T extends object>(
    input: string | undefined,
  ): (keyof T)[] | undefined {
    if (!input) return undefined;

    try {
      const rawFields: string[] = input.trim().startsWith('[')
        ? JSON.parse(input)
        : input.split(',').map((s) => s.trim());

      // Since we can't fully check keys of T at runtime, just cast:
      return rawFields as (keyof T)[];
    } catch (e) {
      console.warn('Failed to parse select:', input);
      return undefined;
    }
  }
}
