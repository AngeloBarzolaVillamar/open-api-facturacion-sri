# Nota de Débito

Comprobante electrónico tipo `05` utilizado para incrementar el valor de una factura.

---

## Endpoint

```
POST /sri/emitir/nota-debito
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
    "razonSocial": "PEDRO GONZALEZ RUIZ"
  },
  "codDocModificado": "01",
  "numDocModificado": "001-001-000000001",
  "fechaEmisionDocSustento": "11/01/2026",
  "motivo": "Cargo adicional por servicio",
  "detalles": [
    {
      "descripcion": "Cargo adicional",
      "cantidad": 1,
      "precioUnitario": 50.00,
      "impuestos": [
        {
          "codigo": "2",
          "codigoPorcentaje": "4",
          "tarifa": 15,
          "baseImponible": 50.00,
          "valor": 7.50
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
| `motivo`                  | string | ✅          | Razón del cargo adicional                   |

---

## Diferencia con Nota de Crédito

| Aspecto       | Nota de Crédito (`04`)   | Nota de Débito (`05`)     |
| ------------- | ------------------------ | ------------------------- |
| **Propósito** | Disminuir valores        | Aumentar valores          |
| **Uso común** | Devoluciones, descuentos | Cargos adicionales        |
| **Afecta**    | Reduce deuda del cliente | Aumenta deuda del cliente |
