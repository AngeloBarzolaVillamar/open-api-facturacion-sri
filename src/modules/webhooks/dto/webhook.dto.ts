import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUrl,
  IsNumber,
  Min,
  Max,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const WEBHOOK_EVENTS = [
  'comprobante.creado',
  'comprobante.autorizado',
  'comprobante.rechazado',
  'comprobante.anulado',
  'comprobante.enviado',
  'certificado.por_vencer',
  'certificado.vencido',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export class CreateWebhookDto {
  @ApiProperty({ description: 'Nombre identificador del webhook' })
  @IsString()
  nombre: string;

  @ApiProperty({ description: 'URL a la que se enviarán las notificaciones' })
  @IsUrl()
  url: string;

  @ApiProperty({
    description: 'Eventos a los que se suscribe',
    example: ['comprobante.autorizado', 'comprobante.rechazado'],
    enum: WEBHOOK_EVENTS,
    isArray: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  eventos: WebhookEvent[];

  @ApiPropertyOptional({
    description: 'ID del emisor (opcional, para filtrar por emisor)',
  })
  @IsOptional()
  @IsString()
  emisorId?: string;

  @ApiPropertyOptional({
    description: 'Número máximo de reintentos',
    default: 3,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  reintentosMax?: number;
}

export class UpdateWebhookDto {
  @ApiPropertyOptional({ description: 'Nombre identificador del webhook' })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    description: 'URL a la que se enviarán las notificaciones',
  })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional({
    description: 'Eventos a los que se suscribe',
    enum: WEBHOOK_EVENTS,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventos?: WebhookEvent[];

  @ApiPropertyOptional({ description: 'Activar/desactivar webhook' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ description: 'Número máximo de reintentos' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  reintentosMax?: number;
}

export class WebhookResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  url: string;

  @ApiProperty({ type: [String] })
  eventos: string[];

  @ApiPropertyOptional()
  emisorId?: string;

  @ApiProperty()
  secreto: string;

  @ApiProperty()
  activo: boolean;

  @ApiProperty()
  reintentosMax: number;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class WebhookLogResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  evento: string;

  @ApiProperty()
  payload: any;

  @ApiPropertyOptional()
  statusCode?: number;

  @ApiPropertyOptional()
  respuesta?: string;

  @ApiProperty()
  intento: number;

  @ApiProperty()
  exitoso: boolean;

  @ApiPropertyOptional()
  error?: string;

  @ApiPropertyOptional()
  tiempoRespuestaMs?: number;

  @ApiProperty()
  createdAt: string;
}
