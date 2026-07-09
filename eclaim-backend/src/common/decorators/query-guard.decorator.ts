import { SetMetadata, /*UseGuards,*/ applyDecorators } from '@nestjs/common';

import { FindOptionsSelect } from 'typeorm';

export type ClassConstructor<T = unknown> = new (...args: unknown[]) => T;

export const PERMISSION = Symbol('PERMISSION');
export const INSTANCE = Symbol('INSTANCE');

export const UseQueryPermissionGuard = <T extends ClassConstructor>(
  instance: T,
  permission: FindOptionsSelect<InstanceType<T>>,
) =>
  applyDecorators(
    SetMetadata(INSTANCE, instance),
    SetMetadata(PERMISSION, permission),
  );
