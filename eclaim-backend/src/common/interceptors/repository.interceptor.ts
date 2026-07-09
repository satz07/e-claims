import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';

import { REPOSITORY_INTERCEPTOR } from '../decorators/repository-interceptor.decorator';

@Injectable()
export class QueryIntercepter<T extends ObjectLiteral>
  implements NestInterceptor
{
  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();

    const entity: EntityTarget<T> = Reflect.getMetadata(
      REPOSITORY_INTERCEPTOR,
      handler,
    );

    const baseRepository = this.dataSource.getRepository<T>(entity);

    const request = context.switchToHttp().getRequest();
    request.repository = baseRepository;

    return next.handle();
  }
}
