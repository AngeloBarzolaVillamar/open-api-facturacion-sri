import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DatabaseService } from '../../database/database.service';
import * as crypto from 'crypto';

export interface WebhookJobData {
  configId: string;
  url: string;
  secreto: string;
  evento: string;
  payload: Record<string, unknown>;
}

/**
 * Processor de webhooks usando BullMQ.
 * Reemplaza los setTimeout() con reintentos nativos de BullMQ.
 * Los reintentos son gestionados por la cola con backoff exponencial.
 */
@Processor('webhook-dispatch')
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly db: DatabaseService) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { configId, url, secreto, evento, payload } = job.data;
    const attempt = job.attemptsMade + 1;
    const startTime = Date.now();

    this.logger.log(
      `[Webhook] Enviando ${evento} a ${url} (intento ${attempt})`,
    );

    const body = JSON.stringify({
      evento,
      payload,
      timestamp: new Date().toISOString(),
    });

    const signature = crypto
      .createHmac('sha256', secreto)
      .update(body)
      .digest('hex');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': evento,
          'X-Webhook-Attempt': String(attempt),
        },
        body,
        signal: AbortSignal.timeout(30000),
      });

      const tiempoRespuesta = Date.now() - startTime;
      const respuestaText = await response.text();

      // Log del intento
      await this.logWebhook(
        configId,
        evento,
        payload,
        response.status,
        respuestaText,
        attempt,
        response.ok,
        null,
        tiempoRespuesta,
      );

      if (!response.ok) {
        // Lanzar error para que BullMQ reintente con backoff
        throw new Error(
          `Webhook respondió con status ${response.status}: ${respuestaText.substring(0, 200)}`,
        );
      }

      this.logger.log(
        `[Webhook] ✅ ${evento} enviado exitosamente a ${url} en ${tiempoRespuesta}ms`,
      );
    } catch (error) {
      const tiempoRespuesta = Date.now() - startTime;

      await this.logWebhook(
        configId,
        evento,
        payload,
        null,
        null,
        attempt,
        false,
        (error as Error).message,
        tiempoRespuesta,
      );

      this.logger.error(
        `[Webhook] ❌ Fallo enviando ${evento} a ${url} (intento ${attempt}): ${(error as Error).message}`,
      );

      // Re-lanzar para que BullMQ gestione el reintento
      throw error;
    }
  }

  private async logWebhook(
    configId: string,
    evento: string,
    payload: Record<string, unknown>,
    statusCode: number | null,
    respuesta: string | null,
    intento: number,
    exitoso: boolean,
    error: string | null,
    tiempoRespuestaMs: number,
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO webhook_logs (config_id, evento, payload, status_code, respuesta, intento, exitoso, error, tiempo_respuesta_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          configId,
          evento,
          payload,
          statusCode,
          respuesta,
          intento,
          exitoso,
          error,
          tiempoRespuestaMs,
        ],
      );
    } catch (logError) {
      this.logger.error(
        `Error al registrar webhook log: ${(logError as Error).message}`,
      );
    }
  }
}
