import { Controller, Query, UnauthorizedException, Sse, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { Public } from '../auth/decorators/public.decorator';
import { RealtimeService } from './realtime.service';

@ApiTags('Realtime')
@Public()
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Sse('events')
  @ApiOperation({ summary: 'Stream SSE de eventos en tiempo real (requiere token como query param)' })
  @ApiQuery({ name: 'token', description: 'JWT access token', required: true })
  events(@Query('token') token: string): Observable<MessageEvent> {
    if (!token) {
      throw new UnauthorizedException('Token requerido');
    }

    const payload = this.realtimeService.validateToken(token);
    if (!payload) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const clientId = randomUUID();
    return this.realtimeService.createConnection(clientId, payload) as Observable<MessageEvent>;
  }
}
