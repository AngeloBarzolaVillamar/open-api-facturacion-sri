import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  Matches,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EmisorDto,
  CompradorDto,
  DetalleFacturaDto,
  PagoDto,
  CampoAdicionalDto,
} from './common.dto';
import { Ambiente, TipoEmision } from '../constants';

export class CreateFacturaDto {
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
      'Número secuencial de la factura. Si no se proporciona, se genera automáticamente.',
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

  @ApiProperty({
    description: 'Detalles de la factura',
    type: [DetalleFacturaDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleFacturaDto)
  detalles: DetalleFacturaDto[];

  @ApiProperty({ description: 'Formas de pago', type: [PagoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoDto)
  pagos: PagoDto[];

  @ApiPropertyOptional({
    description: 'Información adicional',
    type: [CampoAdicionalDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampoAdicionalDto)
  infoAdicional?: CampoAdicionalDto[];

  @ApiPropertyOptional({ description: 'Número de guía de remisión' })
  @IsOptional()
  @IsString()
  guiaRemision?: string;
}

export class FacturaResponseDto {
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

export class ConsultaAutorizacionDto {
  @ApiProperty({ description: 'Clave de acceso de 49 dígitos' })
  @IsString()
  @Matches(/^\d{49}$/, {
    message: 'La clave de acceso debe tener exactamente 49 dígitos numéricos',
  })
  claveAcceso: string;
}
