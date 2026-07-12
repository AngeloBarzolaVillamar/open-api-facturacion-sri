import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Subject, Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, UserRole } from '../auth/dto/auth.dto';

export interface RealtimeEvent {
  event: string;
  data: Record<string, unknown>;
}

interface ClientConnection {
  id: string;
  tenantId: string | null;
  rol: UserRole;
  subject: Subject<RealtimeEvent>;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly connections = new Map<string, ClientConnection>();
  private readonly jwtSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('jwt.secret')!;
  }

  validateToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.verify<JwtPayload>(token, { secret: this.jwtSecret });
    } catch {
      return null;
    }
  }

  createConnection(clientId: string, payload: JwtPayload): Observable<RealtimeEvent> {
    const subject = new Subject<RealtimeEvent>();
    const connection: ClientConnection = {
      id: clientId,
      tenantId: payload.tenantId,
      rol: payload.rol,
      subject,
    };
    this.connections.set(clientId, connection);
    this.logger.log(`Cliente SSE conectado: ${clientId} (tenant: ${payload.tenantId}, rol: ${payload.rol})`);

    return new Observable<RealtimeEvent>((subscriber) => {
      const sub = subject.subscribe(subscriber);
      return () => {
        sub.unsubscribe();
        this.removeConnection(clientId);
      };
    });
  }

  removeConnection(clientId: string): void {
    const conn = this.connections.get(clientId);
    if (conn) {
      conn.subject.complete();
      this.connections.delete(clientId);
      this.logger.log(`Cliente SSE desconectado: ${clientId}`);
    }
  }

  private broadcast(event: string, data: Record<string, unknown>, tenantId?: string | null): void {
    for (const conn of this.connections.values()) {
      if (tenantId && conn.rol !== UserRole.SUPERADMIN && conn.tenantId !== tenantId) {
        continue;
      }
      conn.subject.next({ event, data });
    }
  }

  @OnEvent('comprobante.autorizado')
  handleComprobanteAutorizado(payload: any): void {
    this.broadcast('comprobante.autorizado', {
      claveAcceso: payload.claveAcceso,
      estado: payload.estado,
      tipoComprobante: payload.tipoComprobante,
    }, payload.tenantId);
  }

  @OnEvent('comprobante.rechazado')
  handleComprobanteRechazado(payload: any): void {
    this.broadcast('comprobante.rechazado', {
      claveAcceso: payload.claveAcceso,
      estado: payload.estado,
      tipoComprobante: payload.tipoComprobante,
    }, payload.tenantId);
  }

  @OnEvent('comprobante.creado')
  handleComprobanteCreado(payload: any): void {
    this.broadcast('comprobante.creado', {
      claveAcceso: payload.claveAcceso,
      estado: payload.estado,
      tipoComprobante: payload.tipoComprobante,
    }, payload.tenantId);
  }

  @OnEvent('comprobante.anulado')
  handleComprobanteAnulado(payload: any): void {
    this.broadcast('comprobante.anulado', {
      claveAcceso: payload.claveAcceso,
    }, payload.tenantId);
  }

  @OnEvent('plantilla.creada')
  handlePlantillaCreada(payload: any): void {
    this.broadcast('plantilla.creada', payload);
  }

  @OnEvent('plantilla.eliminada')
  handlePlantillaEliminada(payload: any): void {
    this.broadcast('plantilla.eliminada', payload);
  }

  @OnEvent('certificado.subido')
  handleCertificadoSubido(payload: any): void {
    this.broadcast('certificado.subido', payload, payload.tenantId);
  }

  @OnEvent('certificado.eliminado')
  handleCertificadoEliminado(payload: any): void {
    this.broadcast('certificado.eliminado', payload, payload.tenantId);
  }
}
