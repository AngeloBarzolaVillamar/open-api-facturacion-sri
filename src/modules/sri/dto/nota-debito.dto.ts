import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  Matches,
  IsEnum,
  IsNumber,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EmisorDto,
  CompradorDto,
  ImpuestoDetalleDto,
  CampoAdicionalDto,
} from './common.dto';
import { Ambiente, TipoEmision } from '../constants';

/**
 * Motivo/Razón de la nota de débito
 */
export class MotivoNotaDebitoDto {
  @ApiProperty({ description: 'Razón del cargo adicional' })
  @IsString()
  @IsNotEmpty()
  razon: string;

  @ApiProperty({ description: 'Valor del cargo' })
  @IsNumber()
  @Min(0)
  valor: number;
}

/**
 * DTO para crear una Nota de Débito
 */
export class CreateNotaDebitoDto {
  @ApiPropertyOptional({
    description: 'Ambiente de emisión',
    enum: Ambiente,
    default: Ambiente.PRUEBAS,
  })
  @IsOptional()
  @IsEnum(Ambiente)
  ambiente?: Ambiente;

  @ApiPropertyOptional({
    description: 'Tipo de emisión',
    enum: TipoEmision,
    default: TipoEmision.NORMAL,
  })
  @IsOptional()
  @IsEnum(TipoEmision)
  tipoEmision?: TipoEmision;

  @ApiProperty({ description: 'Fecha de emisión en formato dd/mm/yyyy' })
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'La fecha debe tener el formato dd/mm/yyyy',
  })
  fechaEmision: string;

  @ApiPropertyOptional({
    description:
      'Número secuencial de la nota de débito (auto-generado si se omite)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,9}$/, {
    message: 'El secuencial debe ser numérico de hasta 9 dígitos',
  })
  secuencial?: string;

  @ApiProperty({ description: 'Información del emisor', type: EmisorDto })
  @ValidateNested()
  @Type(() => EmisorDto)
  emisor: EmisorDto;

  @ApiProperty({ description: 'Información del comprador', type: CompradorDto })
  @ValidateNested()
  @Type(() => CompradorDto)
  comprador: CompradorDto;

  // Información del documento modificado (factura original)
  @ApiProperty({
    description: 'Código del documento modificado (01 = Factura)',
  })
  @IsString()
  @Matches(/^\d{2}$/, { message: 'El código debe tener 2 dígitos' })
  codDocModificado: string;

  @ApiProperty({
    description: 'Número del documento modificado (ej: 001-001-000000001)',
  })
  @IsString()
  @Matches(/^\d{3}-\d{3}-\d{9}$/, {
    message: 'El formato debe ser 001-001-000000001',
  })
  numDocModificado: string;

  @ApiProperty({
    description: 'Fecha de emisión del documento modificado (dd/mm/yyyy)',
  })
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'La fecha debe tener el formato dd/mm/yyyy',
  })
  fechaEmisionDocSustento: string;

  @ApiProperty({
    description: 'Motivos/razones de la nota de débito',
    type: [MotivoNotaDebitoDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MotivoNotaDebitoDto)
  motivos: MotivoNotaDebitoDto[];

  @ApiProperty({
    description: 'Impuestos aplicados al total',
    type: [ImpuestoDetalleDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImpuestoDetalleDto)
  impuestos: ImpuestoDetalleDto[];

  @ApiPropertyOptional({
    description: 'Información adicional',
    type: [CampoAdicionalDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampoAdicionalDto)
  infoAdicional?: CampoAdicionalDto[];
}

/**
 * Respuesta de emisión de Nota de Débito
 */
export class NotaDebitoResponseDto {
  @ApiProperty({ description: 'Indica si la operación fue exitosa' })
  success: boolean;

  @ApiProperty({ description: 'Clave de acceso de 49 dígitos' })
  claveAcceso: string;

  @ApiProperty({ description: 'Estado del comprobante' })
  estado: string;

  @ApiPropertyOptional({ description: 'Fecha de autorización' })
  fechaAutorizacion?: string;

  @ApiPropertyOptional({ description: 'Número de autorización' })
  numeroAutorizacion?: string;

  @ApiPropertyOptional({ description: 'XML del comprobante autorizado' })
  xmlAutorizado?: string;

  @ApiPropertyOptional({ description: 'Mensajes del SRI' })
  mensajes?: any[];
}
