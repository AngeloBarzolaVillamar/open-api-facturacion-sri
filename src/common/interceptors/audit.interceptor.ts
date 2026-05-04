import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { AuditService } from '../services/audit.service';

interface RequestUser {
  sub?: string;
  email?: string;
  tenantId?: string;
}

/**
 * Interceptor global de auditoría.
 * Captura automáticamente todas las operaciones mutantes (POST, PUT, PATCH, DELETE)
 * y las registra en la tabla de auditoría.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  // Métodos HTTP que generan registro de auditoría
  private readonly AUDITABLE_METHODS = new Set([
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
  ]);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method?.toUpperCase();

    // Solo auditar métodos mutantes
    if (!this.AUDITABLE_METHODS.has(method)) {
      return next.handle();
    }

    const startTime = Date.now();
    const user = (request as Request & { user?: RequestUser }).user;
    const url = request.url || '';
    const recurso = this.extractRecurso(url);
    const recursoId =
      (request.params?.['id'] as string) ||
      (request.params?.['claveAcceso'] as string);
    const accion = this.methodToAccion(method, url);

    return next.handle().pipe(
      tap(() => {
        const duracionMs = Date.now() - startTime;
        // Fire-and-forget — no bloquear la respuesta
        void this.auditService.log({
          usuarioId: user?.sub,
          usuarioEmail: user?.email,
          tenantId: user?.tenantId,
          ipAddress: request.ip || request.socket?.remoteAddress,
          userAgent: request.headers['user-agent'],
          accion,
          recurso,
          recursoId,
          descripcion: `${method} ${url}`,
          metadata: {
            statusCode: response.statusCode,
            path: url,
          },
          exitoso: true,
          duracionMs,
        });
      }),
      catchError((error: Error) => {
        const duracionMs = Date.now() - startTime;
        // Registrar operaciones fallidas también
        void this.auditService.log({
          usuarioId: user?.sub,
          usuarioEmail: user?.email,
          tenantId: user?.tenantId,
          ipAddress: request.ip || request.socket?.remoteAddress,
          userAgent: request.headers['user-agent'],
          accion,
          recurso,
          recursoId,
          descripcion: `${method} ${url} → ERROR`,
          metadata: {
            path: url,
            errorName: error?.name,
          },
          exitoso: false,
          error: error?.message,
          duracionMs,
        });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Extrae el nombre del recurso de la URL.
   * Ej: /sri/facturas/emitir → sri/facturas
   */
  private extractRecurso(url: string): string {
    const parts = url
      .split('?')[0] // quitar query params
      .split('/')
      .filter((p) => p && !this.isUuid(p));
    return parts.slice(0, 2).join('/') || 'unknown';
  }

  private methodToAccion(method: string, url: string): string {
    if (url.includes('/auth/login')) return 'LOGIN';
    if (url.includes('/auth/register')) return 'REGISTER';
    if (url.includes('/facturas/emitir')) return 'EMITIR_FACTURA';
    if (url.includes('/notas-credito/emitir')) return 'EMITIR_NOTA_CREDITO';
    if (url.includes('/notas-debito/emitir')) return 'EMITIR_NOTA_DEBITO';
    if (url.includes('/retenciones/emitir')) return 'EMITIR_RETENCION';
    if (url.includes('/guias-remision/emitir')) return 'EMITIR_GUIA_REMISION';
    if (url.includes('/sincronizar')) return 'SINCRONIZAR_SRI';

    switch (method) {
      case 'POST':
        return 'CREATE';
      case 'PUT':
      case 'PATCH':
        return 'UPDATE';
      case 'DELETE':
        return 'DELETE';
      default:
        return method;
    }
  }

  private isUuid(s: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      s,
    );
  }
}
