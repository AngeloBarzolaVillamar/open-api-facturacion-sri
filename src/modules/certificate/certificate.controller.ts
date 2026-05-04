import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CertificateService } from './certificate.service';
import {
  UploadCertificateDto,
  ValidateCertificateDto,
} from './dto/certificate.dto';
import {
  STORAGE_PATHS,
  sanitizeFilename,
} from '../../common/utils/storage-paths';
import { DatabaseService } from '../../database';
import { EncryptionService } from '../../common/services/encryption.service';
import { XmlSignerService } from '../sri/services/xml-signer.service';
import { EmisoresService } from '../emisores/emisores.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/auth.dto';

@ApiTags('Certificates')
@ApiBearerAuth('JWT')
@Controller('certificates')
export class CertificateController {
  private readonly logger = new Logger(CertificateController.name);

  constructor(
    private readonly certificateService: CertificateService,
    private readonly db: DatabaseService,
    private readonly encryptionService: EncryptionService,
    private readonly xmlSignerService: XmlSignerService,
    private readonly emisoresService: EmisoresService,
  ) {}

  /**
   * GET /certificates/list-certs
   * List available certificates
   */
  @Get('list-certs')
  @ApiOperation({ summary: 'Listar certificados disponibles' })
  @ApiQuery({ name: 'page', required: false, description: 'Número de página' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Elementos por página',
  })
  @ApiResponse({ status: 200, description: 'Lista de certificados' })
  listCertificates(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const options: { page?: number; limit?: number } = {};
    if (page) options.page = parseInt(page);
    if (limit) options.limit = parseInt(limit);

    const result = this.certificateService.listCertificates(options);

    return {
      success: true,
      data: {
        certificates: result.certificates,
        total: result.total,
        pagination: result.pagination,
      },
    };
  }

  /**
   * DELETE /certificates/delete-cert/:fileName
   * Delete a certificate
   */
  @Delete('delete-cert/:fileName')
  @ApiOperation({ summary: 'Eliminar un certificado' })
  @ApiParam({ name: 'fileName', description: 'Nombre del archivo .p12' })
  @ApiResponse({ status: 200, description: 'Certificado eliminado' })
  @ApiResponse({ status: 404, description: 'Certificado no encontrado' })
  async deleteCertificate(@Param('fileName') fileName: string) {
    if (!fileName || !fileName.toLowerCase().endsWith('.p12')) {
      throw new BadRequestException(
        'Nombre de archivo inválido. Debe tener extensión .p12',
      );
    }

    if (!this.certificateService.certificateExists(fileName)) {
      throw new NotFoundException(`El certificado ${fileName} no existe`);
    }

    // Limpiar datos del certificado en la tabla emisores
    const cleanResult = await this.db.query(
      `UPDATE emisores SET
        certificado_p12 = NULL,
        certificado_password = NULL,
        certificado_password_encrypted = NULL,
        certificado_valido_hasta = NULL,
        certificado_sujeto = NULL,
        certificado_nombre = NULL,
        certificado_updated_at = NULL,
        updated_at = NOW()
       WHERE certificado_nombre = $1
       RETURNING id, ruc`,
      [fileName],
    );

    // Eliminar archivo físico
    this.certificateService.deleteCertificate(fileName);

    const emisoresLimpiados = cleanResult.rows.length;
    this.logger.log(
      `Certificado ${fileName} eliminado. Emisores actualizados: ${emisoresLimpiados}`,
    );

    return {
      success: true,
      data: {
        message: `Certificado ${fileName} eliminado correctamente`,
        emisoresActualizados: emisoresLimpiados,
        emisores: cleanResult.rows,
      },
    };
  }

  /**
   * POST /certificates/upload-cert
   * Upload a P12 certificate with validation
   */
  @Post('upload-cert')
  @ApiOperation({ summary: 'Subir certificado P12 con validación' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        cert: { type: 'string', format: 'binary' },
        password: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Certificado subido y validado' })
  @ApiResponse({ status: 400, description: 'Certificado inválido' })
  @UseInterceptors(
    FileInterceptor('cert', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, STORAGE_PATHS.certs);
        },
        filename: (req, file, cb) => {
          cb(null, sanitizeFilename(file.originalname));
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.originalname.toLowerCase().endsWith('.p12')) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Solo se permiten archivos .p12') as any,
            false,
          );
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadCertificate(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadCertificateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    const { password } = body;

    if (!password) {
      // Delete uploaded file if no password
      const filePath = join(STORAGE_PATHS.certs, file.filename);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }

      throw new BadRequestException(
        'Se requiere la contraseña del certificado para validar su vigencia',
      );
    }

    try {
      // Validate certificate expiry
      const validation = this.certificateService.validateCertificateExpiry(
        file.filename,
        password,
      );

      if (!validation.isValid) {
        // Delete file if certificate is not valid
        this.certificateService.deleteCertificate(file.filename);

        throw new BadRequestException({
          message: `Certificado no válido: ${validation.reason}`,
          validationDetails: {
            isExpired: validation.isExpired,
            isNotYetValid: validation.isNotYetValid,
            expiryDate: validation.expiryDate,
            startDate: validation.startDate,
          },
        });
      }

      const response: any = {
        success: true,
        data: {
          message: 'Certificado subido y validado correctamente',
          fileName: file.filename,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          validation: {
            isValid: validation.isValid,
            expiryDate: validation.expiryDate,
            daysUntilExpiry: validation.daysUntilExpiry,
            subject: validation.subject,
          },
        },
      };

      // Add warning if certificate expires soon
      if (validation.warning) {
        response.data.warning = validation.warning;
      }

      // If RUC is provided, bind certificate to emisor
      if (body.ruc) {
        // Validar acceso tenant antes de bindear
        await this.emisoresService.validateRucAccess(body.ruc, user);

        // Read the P12 file to get the buffer for database storage
        const filePath = join(STORAGE_PATHS.certs, file.filename);
        const p12Buffer = readFileSync(filePath);

        const bindingResult = await this.bindCertificateToEmisor(
          body.ruc,
          file.filename,
          password,
          validation.expiryDate,
          validation.subject?.commonName || '',
          p12Buffer,
        );

        if (bindingResult.success) {
          response.data.emisorBinding = {
            ruc: body.ruc,
            message: 'Certificado vinculado al emisor correctamente',
          };
          this.logger.log(
            `Certificado ${file.filename} vinculado al emisor RUC: ${body.ruc}`,
          );
        } else {
          response.data.emisorBindingWarning = bindingResult.message;
          this.logger.warn(
            `No se pudo vincular certificado: ${bindingResult.message}`,
          );
        }
      }

      return response;
    } catch (error) {
      // If validation error, delete the file
      try {
        this.certificateService.deleteCertificate(file.filename);
      } catch {
        // Ignore deletion error
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        `Error al validar el certificado: ${(error as Error).message}. Verifique la contraseña.`,
      );
    }
  }

  /**
   * Encrypt password using EncryptionService
   */
  private async encryptPassword(password: string): Promise<string> {
    return this.encryptionService.encrypt(password);
  }

  /**
   * Decrypt password using EncryptionService
   */
  async decryptPassword(encryptedPassword: string): Promise<string> {
    return this.encryptionService.decrypt(encryptedPassword);
  }

  /**
   * Bind certificate to emisor in database
   */
  private async bindCertificateToEmisor(
    ruc: string,
    fileName: string,
    password: string,
    expiryDate: Date,
    subject: string,
    p12Buffer: Buffer,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if emisor exists
      const emisor = await this.db.queryOne<any>(
        'SELECT id FROM emisores WHERE ruc = $1',
        [ruc],
      );

      if (!emisor) {
        return { success: false, message: `No existe emisor con RUC ${ruc}` };
      }

      // Encrypt password
      const encryptedPassword = await this.encryptPassword(password);

      // Update emisor with certificate info including the binary P12
      await this.db.query(
        `UPDATE emisores SET 
          certificado_nombre = $1,
          certificado_password_encrypted = $2,
          certificado_valido_hasta = $3,
          certificado_sujeto = $4,
          certificado_p12 = $5,
          certificado_updated_at = NOW()
        WHERE ruc = $6`,
        [fileName, encryptedPassword, expiryDate, subject, p12Buffer, ruc],
      );

      // FIX P4: Invalidar caché del certificado en XmlSignerService
      // para forzar la carga del nuevo P12 en la próxima firma
      this.xmlSignerService.clearEmisorCache(ruc);
      this.logger.log(`Caché de certificado invalidado para RUC: ${ruc}`);

      return { success: true, message: 'Certificado vinculado correctamente' };
    } catch (error) {
      this.logger.error(
        `Error al vincular certificado: ${(error as Error).message}`,
      );
      return { success: false, message: (error as Error).message };
    }
  }

  /**
   * GET /certificates/cert-info/:fileName
   * Get certificate info
   */
  @Get('cert-info/:fileName')
  @ApiOperation({ summary: 'Obtener información de un certificado' })
  @ApiParam({ name: 'fileName', description: 'Nombre del archivo .p12' })
  @ApiResponse({ status: 200, description: 'Información del certificado' })
  getCertificateInfo(@Param('fileName') fileName: string) {
    if (!fileName || !fileName.toLowerCase().endsWith('.p12')) {
      throw new BadRequestException(
        'Nombre de archivo inválido. Debe tener extensión .p12',
      );
    }

    const certInfo = this.certificateService.getCertificateInfo(fileName);

    return {
      success: true,
      data: certInfo,
    };
  }

  /**
   * POST /certificates/validate-cert/:fileName
   * Validate an existing certificate with password
   */
  @Post('validate-cert/:fileName')
  @ApiOperation({ summary: 'Validar certificado existente' })
  @ApiParam({ name: 'fileName', description: 'Nombre del archivo .p12' })
  @ApiResponse({ status: 200, description: 'Resultado de validación' })
  validateCertificate(
    @Param('fileName') fileName: string,
    @Body() body: ValidateCertificateDto,
  ) {
    if (!fileName || !fileName.toLowerCase().endsWith('.p12')) {
      throw new BadRequestException(
        'Nombre de archivo inválido. Debe tener extensión .p12',
      );
    }

    const { password } = body;

    if (!password) {
      throw new BadRequestException(
        'Se requiere la contraseña del certificado',
      );
    }

    const validation = this.certificateService.validateCertificateExpiry(
      fileName,
      password,
    );

    const response: any = {
      success: true,
      data: {
        fileName: fileName,
        validation: validation,
      },
    };

    // If certificate is not valid, change response status
    if (!validation.isValid) {
      response.success = false;
      response.error = validation.reason;
      throw new BadRequestException(response);
    }

    return response;
  }
}
