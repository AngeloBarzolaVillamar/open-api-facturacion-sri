import { Controller, Get, Patch, Body, Param, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PuntosEmisionService } from './puntos-emision.service';
import { EmisoresService } from '../emisores/emisores.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/auth.dto';
import { SecuencialResponseDto, UpdateSecuencialDto } from './dto';

@ApiTags('Emisores - Secuenciales')
@ApiBearerAuth('JWT')
@Controller('emisores/secuenciales')
export class SecuencialesController {
  private readonly logger = new Logger(SecuencialesController.name);

  constructor(
    private readonly service: PuntosEmisionService,
    private readonly emisoresService: EmisoresService,
  ) {}

  @Get(':emisorId')
  @ApiOperation({
    summary: 'Listar todos los secuenciales de un emisor',
    description:
      'Obtiene todos los secuenciales de todos los puntos de emisión de un emisor. Útil para dashboards y vistas generales.',
  })
  @ApiParam({ name: 'emisorId', description: 'UUID del emisor' })
  @ApiResponse({
    status: 200,
    description:
      'Lista completa de secuenciales agrupados por punto de emisión',
  })
  async getAllByEmisor(
    @Param('emisorId') emisorId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<
    Array<
      SecuencialResponseDto & { establecimiento: string; puntoEmision: string }
    >
  > {
    // Validar acceso tenant antes de listar secuenciales
    await this.emisoresService.validateEmisorAccess(emisorId, user);
    return this.service.getAllSecuencialesByEmisor(emisorId);
  }

  @Get(':emisorId/:puntoEmisionId')
  @ApiOperation({
    summary: 'Listar secuenciales de un punto de emisión',
    description:
      'Obtiene todos los secuenciales (Factura, Nota Crédito, Retención, etc.) de un punto de emisión específico.',
  })
  @ApiParam({ name: 'emisorId', description: 'UUID del emisor' })
  @ApiParam({
    name: 'puntoEmisionId',
    description: 'UUID del punto de emisión',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de secuenciales',
    type: [SecuencialResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Punto de emisión no encontrado' })
  async getSecuenciales(
    @Param('emisorId') emisorId: string,
    @Param('puntoEmisionId') puntoEmisionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SecuencialResponseDto[]> {
    await this.emisoresService.validateEmisorAccess(emisorId, user);
    return this.service.getSecuenciales(emisorId, puntoEmisionId);
  }

  @Patch(':emisorId/:puntoEmisionId/:tipoComprobante')
  @ApiOperation({
    summary: 'Actualizar un secuencial específico',
    description:
      'Modifica el último secuencial usado para un tipo de comprobante. Útil para correcciones o reseteos. Tipos válidos: 01=Factura, 04=NC, 05=ND, 06=Guía, 07=Retención',
  })
  @ApiParam({ name: 'emisorId', description: 'UUID del emisor' })
  @ApiParam({
    name: 'puntoEmisionId',
    description: 'UUID del punto de emisión',
  })
  @ApiParam({
    name: 'tipoComprobante',
    description: 'Código del tipo de comprobante',
    example: '01',
  })
  @ApiResponse({
    status: 200,
    description: 'Secuencial actualizado',
    type: SecuencialResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Tipo de comprobante inválido o secuencial negativo',
  })
  @ApiResponse({ status: 404, description: 'Secuencial no encontrado' })
  async updateSecuencial(
    @Param('emisorId') emisorId: string,
    @Param('puntoEmisionId') puntoEmisionId: string,
    @Param('tipoComprobante') tipoComprobante: string,
    @Body() dto: UpdateSecuencialDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SecuencialResponseDto> {
    await this.emisoresService.validateEmisorAccess(emisorId, user);
    return this.service.updateSecuencial(
      emisorId,
      puntoEmisionId,
      tipoComprobante,
      dto,
    );
  }
}
