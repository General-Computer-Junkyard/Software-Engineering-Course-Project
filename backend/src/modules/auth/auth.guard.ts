import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthContext } from './auth.types';

export type AuthedRequest = Request & { auth?: AuthContext };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const authz = req.headers.authorization ?? '';
    const token = this.extractBearer(authz);
    if (!token) throw new UnauthorizedException('Missing Authorization bearer token');
    const auth = this.authService.verifyToken(token);
    req.auth = auth;
    return true;
  }

  private extractBearer(value: string): string | null {
    const m = value.match(/^Bearer\s+(.+)$/i);
    return m?.[1]?.trim() || null;
  }
}



