import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Length,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoIdentificacion, FormaPago } from '../constants';

export class EmisorDto {
  @ApiProperty({ description: 'RUC del emisor (13 dígitos)' })
  @IsString()
  @Length(13, 13, { message: 'El RUC debe tener exactamente 13 dígitos' })
  @Matches(/^\d{13}$/, { message: 'El RUC solo debe contener números' })
  ruc: string;

  @ApiProperty({ description: 'Razón social del emisor' })
  @IsString()
  @IsNotEmpty()
  razonSocial: string;

  @ApiPropertyOptional({ description: 'Nombre comercial' })
  @IsOptional()
  @IsString()
  nombreComercial?: string;

  @ApiProperty({ description: 'Dirección de la matriz' })
  @IsString()
  @IsNotEmpty()
  dirMatriz: string;

  @ApiPropertyOptional({ description: 'Dirección del establecimiento' })
  @IsOptional()
  @IsString()
  dirEstablecimiento?: string;

  @ApiProperty({ description: 'Código del establecimiento (3 dígitos)' })
  @IsString()
  @Length(3, 3)
  @Matches(/^\d{3}$/, { message: 'El establecimiento debe tener 3 dígitos' })
  establecimiento: string;

  @ApiProperty({ description: 'Punto de emisión (3 dígitos)' })
  @IsString()
  @Length(3, 3)
  @Matches(/^\d{3}$/, { message: 'El punto de emisión debe tener 3 dígitos' })
  puntoEmision: string;

  @ApiProperty({
    description: 'Obligado a llevar contabilidad',
    enum: ['SI', 'NO'],
  })
  @IsEnum(['SI', 'NO'])
  obligadoContabilidad: 'SI' | 'NO';

  @ApiPropertyOptional({ description: 'Contribuyente especial' })
  @IsOptional()
  @IsString()
  contribuyenteEspecial?: string;

  @ApiPropertyOptional({ description: 'Número de agente de retención' })
  @IsOptional()
  @IsString()
  agenteRetencion?: string;

  @ApiPropertyOptional({ description: 'Régimen RIMPE' })
  @IsOptional()
  @IsEnum(['CONTRIBUYENTE RÉGIMEN RIMPE'])
  contribuyenteRimpe?: 'CONTRIBUYENTE RÉGIMEN RIMPE';
}

export class CompradorDto {
  @ApiProperty({
    description: 'Tipo de identificación',
    enum: TipoIdentificacion,
  })
  @IsEnum(TipoIdentificacion)
  tipoIdentificacion: TipoIdentificacion;

  @ApiProperty({ description: 'Número de identificación' })
  @IsString()
  @IsNotEmpty()
  identificacion: string;

  @ApiProperty({ description: 'Razón social o nombre del comprador' })
  @IsString()
  @IsNotEmpty()
  razonSocial: string;

  @ApiPropertyOptional({ description: 'Dirección del comprador' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ description: 'Teléfono del comprador' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional({ description: 'Email del comprador' })
  @IsOptional()
  @IsString()
  email?: string;
}

export class ImpuestoDetalleDto {
  @ApiProperty({ description: 'Código del impuesto' })
  @IsString()
  codigo: string;

  @ApiProperty({ description: 'Código del porcentaje' })
  @IsString()
  codigoPorcentaje: string;

  @ApiProperty({ description: 'Tarifa del impuesto' })
  @IsNumber()
  @Min(0)
  tarifa: number;

  @ApiProperty({ description: 'Base imponible' })
  @IsNumber()
  @Min(0)
  baseImponible: number;

  @ApiProperty({ description: 'Valor del impuesto' })
  @IsNumber()
  @Min(0)
  valor: number;
}

export class DetalleAdicionalDto {
  @ApiProperty({ description: 'Nombre del campo adicional' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ description: 'Valor del campo adicional' })
  @IsString()
  @IsNotEmpty()
  valor: string;
}

export class DetalleFacturaDto {
  @ApiProperty({ description: 'Código principal del producto' })
  @IsString()
  @IsNotEmpty()
  codigoPrincipal: string;

  @ApiPropertyOptional({ description: 'Código auxiliar del producto' })
  @IsOptional()
  @IsString()
  codigoAuxiliar?: string;

  @ApiProperty({ description: 'Descripción del producto o servicio' })
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @ApiPropertyOptional({ description: 'Unidad de medida' })
  @IsOptional()
  @IsString()
  unidadMedida?: string;

  @ApiProperty({ description: 'Cantidad' })
  @IsNumber()
  @Min(0)
  cantidad: number;

  @ApiProperty({ description: 'Precio unitario' })
  @IsNumber()
  @Min(0)
  precioUnitario: number;

  @ApiProperty({
    description:
      'Descuento aplicado en valor monetario absoluto (no porcentaje). Ej: 5.00',
  })
  @IsNumber()
  @Min(0)
  descuento: number;

  @ApiPropertyOptional({
    description: 'Detalles adicionales',
    type: [DetalleAdicionalDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleAdicionalDto)
  detallesAdicionales?: DetalleAdicionalDto[];

  @ApiProperty({
    description: 'Impuestos aplicados',
    type: [ImpuestoDetalleDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImpuestoDetalleDto)
  impuestos: ImpuestoDetalleDto[];
}

export class PagoDto {
  @ApiProperty({ description: 'Forma de pago', enum: FormaPago })
  @IsEnum(FormaPago)
  formaPago: FormaPago;

  @ApiProperty({ description: 'Total del pago' })
  @IsNumber()
  @Min(0)
  total: number;

  @ApiPropertyOptional({ description: 'Plazo de pago' })
  @IsOptional()
  @IsNumber()
  plazo?: number;

  @ApiPropertyOptional({
    description: 'Unidad de tiempo',
    enum: ['dias', 'meses', 'años'],
  })
  @IsOptional()
  @IsEnum(['dias', 'meses', 'años'])
  unidadTiempo?: 'dias' | 'meses' | 'años';
}

export class CampoAdicionalDto {
  @ApiProperty({ description: 'Nombre del campo' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ description: 'Valor del campo' })
  @IsString()
  @IsNotEmpty()
  valor: string;
}
