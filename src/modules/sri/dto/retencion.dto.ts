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
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmisorDto, CampoAdicionalDto } from './common.dto';
import { Ambiente, TipoEmision } from '../constants';

/**
 * Impuesto del documento sustento (factura original)
 */
export class ImpuestoDocSustentoDto {
  @ApiProperty({ description: 'Código del impuesto (2=IVA, 3=ICE, 5=IRBPNR)' })
  @IsString()
  @IsNotEmpty()
  codImpuestoDocSustento: string;

  @ApiProperty({ description: 'Código porcentaje (0=0%, 2=12%, 3=14%, 4=15%)' })
  @IsString()
  @IsNotEmpty()
  codigoPorcentaje: string;

  @ApiProperty({ description: 'Base imponible del impuesto' })
  @IsNumber()
  @Min(0)
  baseImponible: number;

  @ApiProperty({ description: 'Tarifa del impuesto (ej: 15.00)' })
  @IsNumber()
  @Min(0)
  tarifa: number;

  @ApiProperty({ description: 'Valor del impuesto' })
  @IsNumber()
  @Min(0)
  valorImpuesto: number;
}

/**
 * Impuesto retenido en el comprobante de retención
 */
export class ImpuestoRetenidoDto {
  @ApiProperty({ description: 'Código del impuesto (1=Renta, 2=IVA, 6=ISD)' })
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @ApiProperty({ description: 'Código de retención según catálogo SRI' })
  @IsString()
  @IsNotEmpty()
  codigoRetencion: string;

  @ApiProperty({
    description: 'Base imponible sobre la que se aplica la retención',
  })
  @IsNumber()
  @Min(0)
  baseImponible: number;

  @ApiProperty({ description: 'Porcentaje de retención' })
  @IsNumber()
  @Min(0)
  porcentajeRetener: number;

  @ApiProperty({ description: 'Valor retenido' })
  @IsNumber()
  @Min(0)
  valorRetenido: number;

  @ApiProperty({ description: 'Código del documento sustento' })
  @IsString()
  @Matches(/^\d{2}$/, { message: 'El código debe tener 2 dígitos' })
  codDocSustento: string;

  @ApiProperty({
    description: 'Número del documento sustento (ej: 001-001-000000001)',
  })
  @IsString()
  @Matches(/^\d{3}-\d{3}-\d{9}$/, {
    message: 'El formato debe ser 001-001-000000001',
  })
  numDocSustento: string;

  @ApiProperty({
    description: 'Fecha de emisión del documento sustento (dd/mm/yyyy)',
  })
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'La fecha debe tener el formato dd/mm/yyyy',
  })
  fechaEmisionDocSustento: string;

  @ApiProperty({ description: 'Total sin impuestos del documento sustento' })
  @IsNumber()
  @Min(0)
  totalSinImpuestos: number;

  @ApiProperty({ description: 'Importe total del documento sustento' })
  @IsNumber()
  @Min(0)
  importeTotal: number;

  @ApiPropertyOptional({
    description: '01=Local, 02=Exterior',
    enum: ['01', '02'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['01', '02'])
  pagoLocExt?: '01' | '02';

  @ApiPropertyOptional({
    description:
      'Código sustento tributario SRI (ej: 01=Crédito tributario IVA). Si se omite, se usa codDocSustento como fallback.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}$/, { message: 'codSustento debe tener 2 dígitos' })
  codSustento?: string;

  @ApiPropertyOptional({
    description:
      'Forma de pago del doc. sustento (01=Sin sist. financiero, 16=Tarjeta débito, 19=Tarjeta crédito, 20=Otros). Default: 01',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}$/, { message: 'formaPago debe tener 2 dígitos' })
  formaPago?: string;

  @ApiProperty({
    description: 'Impuestos del documento sustento',
    type: [ImpuestoDocSustentoDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImpuestoDocSustentoDto)
  impuestosDocSustento: ImpuestoDocSustentoDto[];
}

/**
 * Información del sujeto retenido
 */
export class SujetoRetenidoDto {
  @ApiProperty({ description: 'Tipo de identificación del sujeto retenido' })
  @IsString()
  @Matches(/^\d{2}$/, {
    message: 'El tipo de identificación debe tener 2 dígitos',
  })
  tipoIdentificacion: string;

  @ApiPropertyOptional({
    description: 'Tipo de sujeto retenido (01=Persona Natural, 02=Sociedad)',
  })
  @IsOptional()
  @IsString()
  @IsIn(['01', '02'])
  tipoSujetoRetenido?: '01' | '02';

  @ApiProperty({ description: 'Número de identificación del sujeto retenido' })
  @IsString()
  @IsNotEmpty()
  identificacion: string;

  @ApiProperty({ description: 'Razón social del sujeto retenido' })
  @IsString()
  @IsNotEmpty()
  razonSocial: string;

  @ApiPropertyOptional({ description: 'Dirección del sujeto retenido' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ description: 'Email del sujeto retenido' })
  @IsOptional()
  @IsString()
  email?: string;
}

/**
 * DTO para crear un Comprobante de Retención
 */
export class CreateRetencionDto {
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
      'Número secuencial del comprobante de retención (auto-generado si se omite)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,9}$/, {
    message: 'El secuencial debe ser numérico de hasta 9 dígitos',
  })
  secuencial?: string;

  @ApiProperty({ description: 'Período fiscal (mm/yyyy)' })
  @IsString()
  @Matches(/^\d{2}\/\d{4}$/, {
    message: 'El período fiscal debe tener el formato mm/yyyy',
  })
  periodoFiscal: string;

  @ApiProperty({
    description: 'Información del emisor (agente de retención)',
    type: EmisorDto,
  })
  @ValidateNested()
  @Type(() => EmisorDto)
  emisor: EmisorDto;

  @ApiProperty({
    description: 'Información del sujeto retenido',
    type: SujetoRetenidoDto,
  })
  @ValidateNested()
  @Type(() => SujetoRetenidoDto)
  sujetoRetenido: SujetoRetenidoDto;

  @ApiProperty({
    description: 'Impuestos retenidos',
    type: [ImpuestoRetenidoDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImpuestoRetenidoDto)
  impuestos: ImpuestoRetenidoDto[];

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
 * Respuesta de emisión de Comprobante de Retención
 */
export class RetencionResponseDto {
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
