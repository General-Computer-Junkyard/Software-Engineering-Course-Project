export type AuthRole = 'TEACHER' | 'STUDENT';

export type AuthTokenPayload = {
  sub: string;
  role: AuthRole;
  name?: string;
  studentNo?: string;
  exp: number; // seconds since epoch
};

export type AuthContext = {
  sub: string;
  role: AuthRole;
  name?: string;
  studentNo?: string;
};



