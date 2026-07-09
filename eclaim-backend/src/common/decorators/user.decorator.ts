import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return {
      user: request.user,
      token: request.token, // assuming token is attached to the request
    }; // Assuming the user is attached to the request object
  },
);
