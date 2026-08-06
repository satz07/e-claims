import { SetMetadata } from '@nestjs/common';

export const SKIP_ECLAIM_API_KEY = 'skipEclaimApiKey';

/** Skip API-key check (e.g. health / load-balancer probes). */
export const SkipEclaimApiKey = () => SetMetadata(SKIP_ECLAIM_API_KEY, true);
