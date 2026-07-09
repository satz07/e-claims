import { ConfigService } from '@nestjs/config';

export const getDomainByRoleId = (
  configService: ConfigService,
  roleId: number,
): string => {
  const domainMap: Record<number, string> = {
    1: configService.get<string>('app.dhaDomain'),
    2: configService.get<string>('app.userFacilityDomain'),
    3: configService.get<string>('app.manufactureDomain'),
    4: configService.get<string>('app.cpaDomain'),
  };

  const defaultDomain = configService.get<string>('app.userFacilityDomain');
  return domainMap[roleId] || defaultDomain;
};
