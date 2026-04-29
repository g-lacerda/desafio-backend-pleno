import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { User } from '@prisma/client';

export const REQUEST_USER_KEY = 'user';

/**
 * Injeta o `User` autenticado no parâmetro do controller. Disponível apenas
 * em rotas protegidas pelo `ApiKeyAuthGuard`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User | undefined => {
    const req = ctx.switchToHttp().getRequest<{ [REQUEST_USER_KEY]?: User }>();
    return req[REQUEST_USER_KEY];
  },
);
