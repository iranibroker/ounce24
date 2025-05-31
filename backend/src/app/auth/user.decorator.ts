import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const LoginUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    user._id = user.id;
    return request.user;
  },
);
