import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un endpoint como público — no requiere autenticación JWT.
 * Ejemplo: @Public() en el controller de login o status.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
