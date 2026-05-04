import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Estados posibles de un comprobante
 */
export enum EstadoComprobante {
  PENDIENTE = 'PENDIENTE',
  RECIBIDA = 'RECIBIDA',
  DEVUELTA = 'DEVUELTA',
  AUTORIZADO = 'AUTORIZADO',
  NO_AUTORIZADO = 'NO_AUTORIZADO',
  EN_PROCESO = 'EN_PROCESO',
  RECHAZADO = 'RECHAZADO',
  ANULADO = 'ANULADO',
}

/**
 * Tipos de comprobante
 */
export enum TipoComprobanteQuery {
  FACTURA = '01',
  NOTA_CREDITO = '04',
  NOTA_DEBITO = '05',
  GUIA_REMISION = '06',
  RETENCION = '07',
}

/**
 * DTO para filtros de búsqueda de comprobantes
 */
export class QueryComprobantesDto {
  @ApiPropertyOptional({ description: 'RUC del emisor' })
  @IsOptional()
  @IsString()
  rucEmisor?: string;

  @ApiPropertyOptional({
    description: 'Identificación del comprador/sujeto retenido',
  })
  @IsOptional()
  @IsString()
  identificacionComprador?: string;

  @ApiPropertyOptional({
    description: 'Tipo de comprobante',
    enum: TipoComprobanteQuery,
  })
  @IsOptional()
  @IsEnum(TipoComprobanteQuery)
  tipoComprobante?: TipoComprobanteQuery;

  @ApiPropertyOptional({
    description: 'Estado del comprobante',
    enum: EstadoComprobante,
  })
  @IsOptional()
  @IsEnum(EstadoComprobante)
  estado?: EstadoComprobante;

  @ApiPropertyOptional({ description: 'Fecha de emisión desde (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @ApiPropertyOptional({ description: 'Fecha de emisión hasta (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fechaHasta?: string;

  @ApiPropertyOptional({ description: 'Establecimiento', example: '001' })
  @IsOptional()
  @IsString()
  establecimiento?: string;

  @ApiPropertyOptional({ description: 'Punto de emisión', example: '001' })
  @IsOptional()
  @IsString()
  puntoEmision?: string;

  @ApiPropertyOptional({ description: 'Número de página', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Registros por página', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * DTO de respuesta para un comprobante
 */
export class ComprobanteResponseDto {
  id: string;
  claveAcceso: string;
  tipoComprobante: string;
  tipoComprobanteDescripcion: string;
  ambiente: string;
  fechaEmision: string;
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;

  // Emisor
  rucEmisor: string;
  razonSocialEmisor: string;

  // Comprador/Sujeto
  identificacionComprador: string;
  razonSocialComprador: string;

  // Totales
  subtotal: number;
  totalImpuestos: number;
  total: number;

  // Estado
  estado: string;
  fechaAutorizacion?: string;
  numAutorizacion?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO de respuesta paginada
 */
export class PaginatedComprobantesDto {
  data: ComprobanteResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * DTO de respuesta detallada con detalles
 */
export class ComprobanteDetalladoDto extends ComprobanteResponseDto {
  detalles: Array<{
    id: string;
    codigoPrincipal: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    subtotal: number;
  }>;

  infoAdicional?: Array<{ nombre: string; valor: string }>;

  xmlDisponible: boolean;
}
