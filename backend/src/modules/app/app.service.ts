import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return {
      status: 'ok',
      service: 'cet-nextgen-api',
      ts: new Date().toISOString(),
    };
  }
}

