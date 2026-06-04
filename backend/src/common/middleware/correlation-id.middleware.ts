import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const HEADER = 'x-request-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[HEADER];
    const id =
      typeof incoming === 'string' && incoming.trim().length > 0 && incoming.length <= 128
        ? incoming.trim()
        : randomUUID();

    (req as Request & { id?: string }).id = id;
    res.setHeader(HEADER, id);
    next();
  }
}
