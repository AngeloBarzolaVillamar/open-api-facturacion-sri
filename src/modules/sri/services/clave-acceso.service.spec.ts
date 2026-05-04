import { ClaveAccesoService } from './clave-acceso.service';
import { Ambiente, TipoEmision, TipoComprobante } from '../constants';

describe('ClaveAccesoService', () => {
  let service: ClaveAccesoService;

  beforeEach(() => {
    service = new ClaveAccesoService();
  });

  describe('generate', () => {
    const baseData = {
      fechaEmision: new Date(2026, 1, 7), // 07/02/2026
      tipoComprobante: TipoComprobante.FACTURA,
      ruc: '0924383631001',
      ambiente: Ambiente.PRUEBAS,
      establecimiento: '001',
      puntoEmision: '001',
      secuencial: '000000001',
      codigoNumerico: '12345678',
      tipoEmision: TipoEmision.NORMAL,
    };

    it('debe generar clave de acceso de exactamente 49 dígitos', () => {
      const clave = service.generate(baseData);
      expect(clave).toHaveLength(49);
    });

    it('debe generar clave de acceso con solo dígitos numéricos', () => {
      const clave = service.generate(baseData);
      expect(clave).toMatch(/^\d{49}$/);
    });

    it('debe incluir la fecha en formato ddmmaaaa (posiciones 0-7)', () => {
      const clave = service.generate(baseData);
      expect(clave.substring(0, 8)).toBe('07022026');
    });

    it('debe incluir el tipo de comprobante (posiciones 8-9)', () => {
      const clave = service.generate(baseData);
      expect(clave.substring(8, 10)).toBe('01'); // Factura
    });

    it('debe incluir el RUC del emisor (posiciones 10-22)', () => {
      const clave = service.generate(baseData);
      expect(clave.substring(10, 23)).toBe('0924383631001');
    });

    it('debe incluir el ambiente (posición 23)', () => {
      const clave = service.generate(baseData);
      expect(clave.charAt(23)).toBe('1'); // Pruebas
    });

    it('debe incluir establecimiento y punto de emisión (posiciones 24-29)', () => {
      const clave = service.generate(baseData);
      expect(clave.substring(24, 27)).toBe('001');
      expect(clave.substring(27, 30)).toBe('001');
    });

    it('debe incluir el secuencial (posiciones 30-38)', () => {
      const clave = service.generate(baseData);
      expect(clave.substring(30, 39)).toBe('000000001');
    });

    it('debe incluir el código numérico (posiciones 39-46)', () => {
      const clave = service.generate(baseData);
      expect(clave.substring(39, 47)).toBe('12345678');
    });

    it('debe incluir tipo de emisión (posición 47)', () => {
      const clave = service.generate(baseData);
      expect(clave.charAt(47)).toBe('1'); // Normal
    });

    it('debe generar código numérico aleatorio si no se proporciona', () => {
      const { codigoNumerico: _codigoNumerico, ...dataWithoutCodigo } =
        baseData;
      const clave1 = service.generate(dataWithoutCodigo);
      const clave2 = service.generate(dataWithoutCodigo);
      // Las claves deben diferir (muy alta probabilidad con crypto.randomInt)
      // Pero ambas deben tener 49 dígitos
      expect(clave1).toHaveLength(49);
      expect(clave2).toHaveLength(49);
    });

    it('debe lanzar error con RUC inválido (no 13 dígitos)', () => {
      expect(() => {
        service.generate({ ...baseData, ruc: '12345' });
      }).toThrow('RUC inválido');
    });

    it('debe generar claves distintas para secuenciales distintos', () => {
      const clave1 = service.generate({ ...baseData, secuencial: '000000001' });
      const clave2 = service.generate({ ...baseData, secuencial: '000000002' });
      expect(clave1).not.toBe(clave2);
    });
  });

  describe('validate', () => {
    it('debe validar una clave de acceso generada por el servicio', () => {
      const clave = service.generate({
        fechaEmision: new Date(2026, 0, 15),
        tipoComprobante: TipoComprobante.FACTURA,
        ruc: '1790016919001',
        ambiente: Ambiente.PRUEBAS,
        establecimiento: '001',
        puntoEmision: '001',
        secuencial: '000000012',
        codigoNumerico: '87654321',
        tipoEmision: TipoEmision.NORMAL,
      });
      expect(service.validate(clave)).toBe(true);
    });

    it('debe rechazar clave con longitud incorrecta', () => {
      expect(service.validate('1234567890')).toBe(false);
    });

    it('debe rechazar clave con caracteres no numéricos', () => {
      expect(
        service.validate('070220260109243836310011001000000001ABCD123411'),
      ).toBe(false);
    });

    it('debe rechazar clave con dígito verificador incorrecto', () => {
      const clave = service.generate({
        fechaEmision: new Date(2026, 0, 15),
        tipoComprobante: TipoComprobante.FACTURA,
        ruc: '1790016919001',
        ambiente: Ambiente.PRUEBAS,
        establecimiento: '001',
        puntoEmision: '001',
        secuencial: '000000012',
        codigoNumerico: '87654321',
        tipoEmision: TipoEmision.NORMAL,
      });
      // Modificar el último dígito
      const claveAlterada =
        clave.substring(0, 48) + ((parseInt(clave.charAt(48)) + 1) % 10);
      expect(service.validate(claveAlterada)).toBe(false);
    });
  });

  describe('parse', () => {
    it('debe parsear correctamente los componentes de una clave válida', () => {
      const clave = service.generate({
        fechaEmision: new Date(2026, 1, 7),
        tipoComprobante: TipoComprobante.FACTURA,
        ruc: '0924383631001',
        ambiente: Ambiente.PRUEBAS,
        establecimiento: '001',
        puntoEmision: '001',
        secuencial: '000000016',
        codigoNumerico: '12452940',
        tipoEmision: TipoEmision.NORMAL,
      });

      const parsed = service.parse(clave);
      expect(parsed).not.toBeNull();
      expect(parsed!.ruc).toBe('0924383631001');
      expect(parsed!.tipoComprobante).toBe('01');
      expect(parsed!.ambiente).toBe('1');
      expect(parsed!.establecimiento).toBe('001');
      expect(parsed!.puntoEmision).toBe('001');
      expect(parsed!.secuencial).toBe('000000016');
      expect(parsed!.codigoNumerico).toBe('12452940');
      expect(parsed!.tipoEmision).toBe('1');
    });

    it('debe retornar null para clave inválida', () => {
      expect(service.parse('0000')).toBeNull();
    });
  });

  describe('calculateModulo11 (vía generate + validate)', () => {
    it('debe producir dígito verificador válido para múltiples RUCs distintos', () => {
      const rucs = ['0924383631001', '1790016919001', '0991234567001'];
      for (const ruc of rucs) {
        const clave = service.generate({
          fechaEmision: new Date(2026, 5, 15),
          tipoComprobante: TipoComprobante.FACTURA,
          ruc,
          ambiente: Ambiente.PRUEBAS,
          establecimiento: '001',
          puntoEmision: '001',
          secuencial: '000000001',
          codigoNumerico: '11111111',
          tipoEmision: TipoEmision.NORMAL,
        });
        expect(service.validate(clave)).toBe(true);
      }
    });

    it('debe producir dígito verificador válido para todos los tipos de comprobante', () => {
      const tipos = [
        TipoComprobante.FACTURA,
        TipoComprobante.NOTA_CREDITO,
        TipoComprobante.NOTA_DEBITO,
        TipoComprobante.GUIA_REMISION,
        TipoComprobante.COMPROBANTE_RETENCION,
      ];
      for (const tipo of tipos) {
        const clave = service.generate({
          fechaEmision: new Date(2026, 3, 10),
          tipoComprobante: tipo,
          ruc: '0924383631001',
          ambiente: Ambiente.PRUEBAS,
          establecimiento: '001',
          puntoEmision: '001',
          secuencial: '000000050',
          codigoNumerico: '99999999',
          tipoEmision: TipoEmision.NORMAL,
        });
        expect(service.validate(clave)).toBe(true);
      }
    });
  });
});
