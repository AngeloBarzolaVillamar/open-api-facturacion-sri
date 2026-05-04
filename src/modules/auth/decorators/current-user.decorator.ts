import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../dto/auth.dto';

/**
 * Decorador para extraer el usuario actual del request.
 * Ejemplo: @CurrentUser() user: JwtPayload
 */
export const CurrentUser = createParamDecorator(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
