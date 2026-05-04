import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../dto/auth.dto';

export const ROLES_KEY = 'roles';

/**
 * Decorador para requerir roles específicos en un endpoint.
 * Ejemplo: @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
