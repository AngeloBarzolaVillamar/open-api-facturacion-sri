import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CatalogoValidatorService } from './services/catalogo-validator.service';

@ApiTags('Catálogos SRI')
@Controller('catalogos')
export class CatalogosController {
  private readonly logger = new Logger(CatalogosController.name);

  constructor(private readonly catalogoService: CatalogoValidatorService) {}

  @Get('impuestos')
  @ApiOperation({
    summary: 'Listar tarifas de impuestos',
    description:
      'Obtiene todas las tarifas de impuestos vigentes (IVA, ICE, IRBPNR)',
  })
  @ApiResponse({ status: 200, description: 'Lista de tarifas de impuestos' })
  async listarImpuestos(): Promise<{ impuestos: any[] }> {
    this.logger.log('GET /catalogos/impuestos');

    // Get all tarifas for each impuesto type
    const iva = await this.catalogoService.getTarifasVigentes('2');
    const ice = await this.catalogoService.getTarifasVigentes('3');
    const irbpnr = await this.catalogoService.getTarifasVigentes('5');

    return {
      impuestos: [
        {
          codigo: '2',
          nombre: 'IVA',
          tarifas: iva.map((t) => ({
            codigoPorcentaje: t.codigo_porcentaje,
            descripcion: t.descripcion,
            porcentaje: t.porcentaje,
          })),
        },
        {
          codigo: '3',
          nombre: 'ICE',
          tarifas: ice.map((t) => ({
            codigoPorcentaje: t.codigo_porcentaje,
            descripcion: t.descripcion,
            porcentaje: t.porcentaje,
          })),
        },
        {
          codigo: '5',
          nombre: 'IRBPNR',
          tarifas: irbpnr.map((t) => ({
            codigoPorcentaje: t.codigo_porcentaje,
            descripcion: t.descripcion,
            porcentaje: t.porcentaje,
          })),
        },
      ],
    };
  }

  @Get('retenciones')
  @ApiOperation({
    summary: 'Listar códigos de retención',
    description: 'Obtiene todos los códigos de retención vigentes',
  })
  @ApiResponse({ status: 200, description: 'Lista de códigos de retención' })
  async listarRetenciones(): Promise<{ retenciones: any[] }> {
    this.logger.log('GET /catalogos/retenciones');

    const renta = await this.catalogoService.getRetencionesPorTipo('RENTA');
    const iva = await this.catalogoService.getRetencionesPorTipo('IVA');

    return {
      retenciones: [
        {
          tipo: 'RENTA',
          codigoImpuesto: '1',
          codigos: renta.map((r) => ({
            codigo: r.codigo,
            descripcion: r.descripcion,
            porcentaje: r.porcentaje,
          })),
        },
        {
          tipo: 'IVA',
          codigoImpuesto: '2',
          codigos: iva.map((r) => ({
            codigo: r.codigo,
            descripcion: r.descripcion,
            porcentaje: r.porcentaje,
          })),
        },
      ],
    };
  }

  @Get('formas-pago')
  @ApiOperation({
    summary: 'Listar formas de pago',
    description: 'Obtiene todas las formas de pago válidas',
  })
  @ApiResponse({ status: 200, description: 'Lista de formas de pago' })
  async listarFormasPago(): Promise<{ formasPago: any[] }> {
    this.logger.log('GET /catalogos/formas-pago');

    const formasPago = await this.catalogoService.getFormasPago();

    return {
      formasPago: formasPago.map((fp) => ({
        codigo: fp.codigo,
        descripcion: fp.descripcion,
      })),
    };
  }

  @Get('tipos-identificacion')
  @ApiOperation({
    summary: 'Listar tipos de identificación',
    description: 'Obtiene todos los tipos de identificación válidos',
  })
  @ApiResponse({ status: 200, description: 'Lista de tipos de identificación' })
  async listarTiposIdentificacion(): Promise<{ tiposIdentificacion: any[] }> {
    this.logger.log('GET /catalogos/tipos-identificacion');

    const tipos = await this.catalogoService.getTiposIdentificacion();

    return {
      tiposIdentificacion: tipos.map((ti) => ({
        codigo: ti.codigo,
        descripcion: ti.descripcion,
        longitud: ti.longitud,
      })),
    };
  }

  @Get('documentos-sustento')
  @ApiOperation({
    summary: 'Listar documentos sustento',
    description: 'Obtiene todos los códigos de documentos sustento válidos',
  })
  @ApiResponse({ status: 200, description: 'Lista de documentos sustento' })
  async listarDocumentosSustento(): Promise<{ documentosSustento: any[] }> {
    this.logger.log('GET /catalogos/documentos-sustento');

    const documentos = await this.catalogoService.getDocumentosSustento();

    return {
      documentosSustento: documentos.map((ds) => ({
        codigo: ds.codigo,
        descripcion: ds.descripcion,
      })),
    };
  }

  @Get('motivos-traslado')
  @ApiOperation({
    summary: 'Listar motivos de traslado',
    description: 'Obtiene todos los motivos de traslado para guías de remisión',
  })
  @ApiResponse({ status: 200, description: 'Lista de motivos de traslado' })
  async listarMotivosTraslado(): Promise<{ motivosTraslado: any[] }> {
    this.logger.log('GET /catalogos/motivos-traslado');

    const motivos = await this.catalogoService.getMotivosTraslado();

    return {
      motivosTraslado: motivos.map((mt) => ({
        codigo: mt.codigo,
        descripcion: mt.descripcion,
      })),
    };
  }
}
