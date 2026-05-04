# Comprobante de Retención

Comprobante electrónico tipo `07` emitido por agentes de retención.

---

## Endpoint

```
POST /sri/emitir/retencion
```

---

## Estructura del JSON

```json
{
  "fechaEmision": "30/01/2026",
  "emisor": { ... },
  "sujeto": {
    "tipoIdentificacion": "04",
    "identificacion": "0992877000001",
    "razonSocial": "PROVEEDOR S.A.",
    "email": "proveedor@empresa.com"
  },
  "periodoFiscal": "01/2026",
  "retenciones": [
    {
      "codigo": "1",
      "codigoRetencion": "303",
      "baseImponible": 1000.00,
      "porcentajeRetener": 10,
      "valorRetenido": 100.00,
      "codDocSustento": "01",
      "numDocSustento": "001-001-000000001",
      "fechaEmisionDocSustento": "15/01/2026"
    }
  ]
}
```

---

## Campos del Sujeto Retenido

| Campo                | Tipo   | Obligatorio | Descripción              |
| -------------------- | ------ | ----------- | ------------------------ |
| `tipoIdentificacion` | string | ✅          | Código tipo ID           |
| `identificacion`     | string | ✅          | RUC/Cédula del proveedor |
| `razonSocial`        | string | ✅          | Razón social             |
| `email`              | string | ❌          | Email para notificación  |

---

## Campos de Retención

| Campo                     | Tipo   | Obligatorio | Descripción           |
| ------------------------- | ------ | ----------- | --------------------- |
| `codigo`                  | string | ✅          | `1`=Renta, `2`=IVA    |
| `codigoRetencion`         | string | ✅          | Código del porcentaje |
| `baseImponible`           | number | ✅          | Base para cálculo     |
| `porcentajeRetener`       | number | ✅          | Porcentaje a retener  |
| `valorRetenido`           | number | ✅          | Valor calculado       |
| `codDocSustento`          | string | ✅          | Tipo doc. sustento    |
| `numDocSustento`          | string | ✅          | Número doc. sustento  |
| `fechaEmisionDocSustento` | string | ✅          | Fecha doc. sustento   |

---

## Códigos de Retención Renta

| Código | Concepto                  | %   |
| ------ | ------------------------- | --- |
| `303`  | Honorarios profesionales  | 10% |
| `304`  | Predomina el intelecto    | 8%  |
| `307`  | Predomina mano de obra    | 2%  |
| `309`  | Publicidad y comunicación | 1%  |
| `310`  | Transporte privado        | 1%  |
| `312`  | Bienes muebles            | 1%  |
| `322`  | Seguros                   | 1%  |

---

## Códigos de Retención IVA

| Código | Concepto                | %    |
| ------ | ----------------------- | ---- |
| `1`    | Retención IVA Bienes    | 30%  |
| `2`    | Retención IVA Servicios | 70%  |
| `3`    | Retención IVA Total     | 100% |

---

## Periodo Fiscal

Formato: `MM/YYYY`

Ejemplo: `01/2026` (Enero 2026)
