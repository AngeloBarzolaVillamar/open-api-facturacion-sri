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
  CampoAdicionalDto,
  DetalleAdicionalDto,
} from './common.dto';
import { Ambiente, TipoEmision } from '../constants';

/**
 * Detalle de un producto en la guía de remisión
 */
export class DetalleGuiaRemisionDto {
  @ApiProperty({ description: 'Código interno del producto' })
  @IsString()
  @IsNotEmpty()
  codigoInterno: string;

  @ApiPropertyOptional({ description: 'Código adicional del producto' })
  @IsOptional()
  @IsString()
  codigoAdicional?: string;

  @ApiProperty({ description: 'Descripción del producto' })
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @ApiProperty({ description: 'Cantidad del producto' })
  @IsNumber()
  @Min(0)
  cantidad: number;

  @ApiPropertyOptional({
    description: 'Detalles adicionales del producto',
    type: [DetalleAdicionalDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleAdicionalDto)
  detallesAdicionales?: DetalleAdicionalDto[];
}

/**
 * Información del destinatario
 */
export class DestinatarioDto {
  @ApiProperty({
    description:
      'Tipo de identificación del destinatario (04=RUC, 05=Cédula, 06=Pasaporte, 07=Consumidor Final)',
  })
  @IsString()
  @Matches(/^\d{2}$/, {
    message: 'El tipo de identificación debe tener 2 dígitos',
  })
  tipoIdentificacionDestinatario: string;

  @ApiProperty({ description: 'Razón social del destinatario' })
  @IsString()
  @IsNotEmpty()
  razonSocialDestinatario: string;

  @ApiProperty({ description: 'Identificación del destinatario' })
  @IsString()
  @IsNotEmpty()
  identificacionDestinatario: string;

  @ApiProperty({ description: 'Dirección del destinatario' })
  @IsString()
  @IsNotEmpty()
  dirDestinatario: string;

  @ApiPropertyOptional({
    description: 'Email del destinatario para envío automático',
  })
  @IsOptional()
  @IsString()
  emailDestinatario?: string;

  @ApiProperty({ description: 'Motivo del traslado' })
  @IsString()
  @IsNotEmpty()
  motivoTraslado: string;

  @ApiPropertyOptional({ description: 'Número de documento aduanero único' })
  @IsOptional()
  @IsString()
  docAduaneroUnico?: string;

  @ApiPropertyOptional({ description: 'Código del establecimiento destino' })
  @IsOptional()
  @IsString()
  codEstabDestino?: string;

  @ApiPropertyOptional({ description: 'Ruta de destino' })
  @IsOptional()
  @IsString()
  ruta?: string;

  @ApiPropertyOptional({ description: 'Código documento sustento' })
  @IsOptional()
  @IsString()
  codDocSustento?: string;

  @ApiPropertyOptional({ description: 'Número documento sustento' })
  @IsOptional()
  @IsString()
  numDocSustento?: string;

  @ApiPropertyOptional({
    description: 'Número de autorización documento sustento',
  })
  @IsOptional()
  @IsString()
  numAutDocSustento?: string;

  @ApiPropertyOptional({ description: 'Fecha de emisión documento sustento' })
  @IsOptional()
  @IsString()
  fechaEmisionDocSustento?: string;

  @ApiProperty({
    description: 'Detalles de productos',
    type: [DetalleGuiaRemisionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleGuiaRemisionDto)
  detalles: DetalleGuiaRemisionDto[];
}

/**
 * DTO para crear una Guía de Remisión
 */
export class CreateGuiaRemisionDto {
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

  @ApiProperty({ description: 'Fecha de inicio de transporte (dd/mm/yyyy)' })
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'La fecha debe tener el formato dd/mm/yyyy',
  })
  fechaIniTransporte: string;

  @ApiProperty({ description: 'Fecha de fin de transporte (dd/mm/yyyy)' })
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'La fecha debe tener el formato dd/mm/yyyy',
  })
  fechaFinTransporte: string;

  @ApiPropertyOptional({
    description: 'Número secuencial de la guía (auto-generado si se omite)',
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

  @ApiProperty({ description: 'Dirección de partida' })
  @IsString()
  @IsNotEmpty()
  dirPartida: string;

  @ApiProperty({ description: 'RUC del transportista' })
  @IsString()
  @Matches(/^\d{13}$/, { message: 'El RUC debe tener 13 dígitos' })
  rucTransportista: string;

  @ApiProperty({ description: 'Tipo de identificación del transportista' })
  @IsString()
  @Matches(/^\d{2}$/, {
    message: 'El tipo de identificación debe tener 2 dígitos',
  })
  tipoIdentificacionTransportista: string;

  @ApiProperty({ description: 'Razón social del transportista' })
  @IsString()
  @IsNotEmpty()
  razonSocialTransportista: string;

  @ApiProperty({ description: 'Placa del vehículo' })
  @IsString()
  @IsNotEmpty()
  placa: string;

  @ApiProperty({ description: 'Destinatarios', type: [DestinatarioDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DestinatarioDto)
  destinatarios: DestinatarioDto[];

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
 * Respuesta de emisión de Guía de Remisión
 */
export class GuiaRemisionResponseDto {
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
