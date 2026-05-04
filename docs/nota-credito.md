# Nota de Crédito

Comprobante electrónico tipo `04` utilizado para modificar una factura emitida.

---

## Endpoint

```
POST /sri/emitir/nota-credito
```

---

## Estructura del JSON

```json
{
  "fechaEmision": "30/01/2026",
  "emisor": { ... },
  "comprador": {
    "tipoIdentificacion": "05",
    "identificacion": "0926789017",
    "razonSocial": "PEDRO GONZALEZ RUIZ",
    "email": "pedro@test.com"
  },
  "codDocModificado": "01",
  "numDocModificado": "001-001-000000001",
  "fechaEmisionDocSustento": "11/01/2026",
  "motivo": "Devolución total del producto",
  "detalles": [
    {
      "codigoPrincipal": "PROD100",
      "descripcion": "Producto devuelto",
      "cantidad": 1,
      "precioUnitario": 100.00,
      "descuento": 0,
      "impuestos": [
        {
          "codigo": "2",
          "codigoPorcentaje": "4",
          "tarifa": 15,
          "baseImponible": 100.00,
          "valor": 15.00
        }
      ]
    }
  ]
}
```

---

## Campos Específicos

| Campo                     | Tipo   | Obligatorio | Descripción                                 |
| ------------------------- | ------ | ----------- | ------------------------------------------- |
| `codDocModificado`        | string | ✅          | Código del doc. modificado (`01` = Factura) |
| `numDocModificado`        | string | ✅          | Número del doc. (001-001-000000001)         |
| `fechaEmisionDocSustento` | string | ✅          | Fecha emisión original (dd/mm/yyyy)         |
| `motivo`                  | string | ✅          | Razón de la nota de crédito                 |

---

## Códigos de Documento Modificado

| Código | Tipo            |
| ------ | --------------- |
| `01`   | Factura         |
| `04`   | Nota de Crédito |
| `05`   | Nota de Débito  |

---

## Campos del Comprador

| Campo                | Tipo   | Obligatorio | Descripción             |
| -------------------- | ------ | ----------- | ----------------------- |
| `tipoIdentificacion` | string | ✅          | Código tipo ID          |
| `identificacion`     | string | ✅          | Número identificación   |
| `razonSocial`        | string | ✅          | Razón social            |
| `direccion`          | string | ❌          | Dirección               |
| `email`              | string | ❌          | Email para notificación |

---

## Estructura de Impuestos

```json
{
  "codigo": "2",
  "codigoPorcentaje": "4",
  "tarifa": 15,
  "baseImponible": 100.0,
  "valor": 15.0
}
```

| Campo              | Descripción                    |
| ------------------ | ------------------------------ |
| `codigo`           | `2` = IVA                      |
| `codigoPorcentaje` | `0` = 0%, `2` = 12%, `4` = 15% |
| `tarifa`           | Porcentaje aplicado            |
| `baseImponible`    | Base para cálculo              |
| `valor`            | Valor del impuesto             |
