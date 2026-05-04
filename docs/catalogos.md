# Catálogos SRI

Códigos oficiales utilizados en la facturación electrónica de Ecuador.

---

## Tipos de Identificación

| Código | Descripción                 |
| ------ | --------------------------- |
| `04`   | RUC                         |
| `05`   | Cédula                      |
| `06`   | Pasaporte                   |
| `07`   | Consumidor Final            |
| `08`   | Identificación del Exterior |

---

## Tipos de Comprobante

| Código | Descripción              |
| ------ | ------------------------ |
| `01`   | Factura                  |
| `04`   | Nota de Crédito          |
| `05`   | Nota de Débito           |
| `06`   | Guía de Remisión         |
| `07`   | Comprobante de Retención |

---

## Formas de Pago

| Código | Descripción                                  |
| ------ | -------------------------------------------- |
| `01`   | Sin utilización del sistema financiero       |
| `15`   | Compensación de deudas                       |
| `16`   | Tarjeta de débito                            |
| `17`   | Dinero electrónico                           |
| `18`   | Tarjeta prepago                              |
| `19`   | Tarjeta de crédito                           |
| `20`   | Otros con utilización del sistema financiero |
| `21`   | Endoso de títulos                            |

---

## Tarifas IVA

| Código | Tarifa       | Descripción           |
| ------ | ------------ | --------------------- |
| `0`    | 0%           | Tarifa 0%             |
| `2`    | 12%          | Tarifa 12% (anterior) |
| `3`    | 14%          | Tarifa 14%            |
| `4`    | 15%          | Tarifa 15% (vigente)  |
| `5`    | 5%           | Tarifa 5%             |
| `6`    | No objeto    | No objeto de impuesto |
| `7`    | Exento       | Exento de IVA         |
| `8`    | Diferenciado | IVA diferenciado      |

---

## Códigos de Impuesto

| Código | Descripción |
| ------ | ----------- |
| `2`    | IVA         |
| `3`    | ICE         |
| `5`    | IRBPNR      |

---

## Motivos de Traslado

| Código | Descripción                     |
| ------ | ------------------------------- |
| `01`   | Venta                           |
| `02`   | Compra                          |
| `03`   | Transformación                  |
| `04`   | Consignación                    |
| `05`   | Devolución                      |
| `06`   | Traslado entre establecimientos |
| `07`   | Traslado por emisor itinerante  |
| `08`   | Exportación                     |
| `09`   | Importación                     |
| `10`   | Otros                           |

---

## Tipos de Retención

### Renta

| Código | Descripción                  | Porcentaje |
| ------ | ---------------------------- | ---------- |
| `303`  | Honorarios profesionales     | 10%        |
| `304`  | Predomina intelecto          | 8%         |
| `307`  | Predomina mano de obra       | 2%         |
| `309`  | Publicidad y comunicación    | 1%         |
| `310`  | Transporte privado           | 1%         |
| `312`  | Transferencia bienes muebles | 1%         |
| `322`  | Seguros y reaseguros         | 1%         |

### IVA

| Código | Descripción        | Porcentaje |
| ------ | ------------------ | ---------- |
| `1`    | Retención 10% IVA  | 10%        |
| `2`    | Retención 20% IVA  | 20%        |
| `3`    | Retención 30% IVA  | 30%        |
| `4`    | Retención 70% IVA  | 70%        |
| `5`    | Retención 100% IVA | 100%       |

---

## Endpoints de Catálogos

```bash
GET /sri/catalogos/tipos-identificacion
GET /sri/catalogos/tipos-comprobante
GET /sri/catalogos/formas-pago
GET /sri/catalogos/tarifas-iva
GET /sri/catalogos/motivos-traslado
GET /sri/catalogos/tipos-retencion
```
