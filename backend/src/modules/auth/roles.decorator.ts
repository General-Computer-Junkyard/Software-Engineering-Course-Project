import { SetMetadata } from '@nestjs/common';
import type { AuthRole } from './auth.types';

export const ROLES_KEY = 'auth.roles';
export const Roles = (...roles: AuthRole[]) => SetMetadata(ROLES_KEY, roles);




