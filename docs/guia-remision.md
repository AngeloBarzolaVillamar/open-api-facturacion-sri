# Guía de Remisión

Comprobante electrónico tipo `06` utilizado para documentar el traslado de mercancías.

---

## Endpoint

```
POST /sri/emitir/guia-remision
```

---

## Estructura del JSON

```json
{
  "fechaIniTransporte": "30/01/2026",
  "fechaFinTransporte": "31/01/2026",
  "emisor": { ... },
  "dirPartida": "Guayaquil, Av. Principal 123",
  "razonSocialTransportista": "TRANSPORTES ECUADOR S.A.",
  "tipoIdentificacionTransportista": "04",
  "rucTransportista": "0957771397001",
  "placa": "ABC-1234",
  "destinatarios": [
    {
      "tipoIdentificacionDestinatario": "05",
      "identificacionDestinatario": "0926789017",
      "razonSocialDestinatario": "PEDRO GONZALEZ",
      "dirDestinatario": "Quito, Ecuador",
      "emailDestinatario": "pedro@email.com",
      "motivoTraslado": "Venta de mercadería",
      "codDocSustento": "01",
      "numDocSustento": "001-001-000000008",
      "fechaEmisionDocSustento": "28/01/2026",
      "detalles": [
        {
          "codigoInterno": "PROD100",
          "descripcion": "Producto de prueba",
          "cantidad": 10
        }
      ]
    }
  ]
}
```

---

## Campos del Emisor

| Campo                  | Tipo   | Obligatorio | Descripción                        |
| ---------------------- | ------ | ----------- | ---------------------------------- |
| `ruc`                  | string | ✅          | RUC del emisor (13 dígitos)        |
| `razonSocial`          | string | ✅          | Razón social                       |
| `nombreComercial`      | string | ❌          | Nombre comercial                   |
| `dirMatriz`            | string | ✅          | Dirección matriz                   |
| `dirEstablecimiento`   | string | ✅          | Dirección establecimiento          |
| `establecimiento`      | string | ✅          | Código establecimiento (3 dígitos) |
| `puntoEmision`         | string | ✅          | Punto de emisión (3 dígitos)       |
| `obligadoContabilidad` | enum   | ✅          | `SI` o `NO`                        |

---

## Campos del Transportista

| Campo                             | Tipo   | Obligatorio | Descripción               |
| --------------------------------- | ------ | ----------- | ------------------------- |
| `dirPartida`                      | string | ✅          | Dirección de partida      |
| `fechaIniTransporte`              | string | ✅          | Fecha inicio (dd/mm/yyyy) |
| `fechaFinTransporte`              | string | ✅          | Fecha fin (dd/mm/yyyy)    |
| `razonSocialTransportista`        | string | ✅          | Nombre del transportista  |
| `tipoIdentificacionTransportista` | string | ✅          | Código tipo ID            |
| `rucTransportista`                | string | ✅          | RUC/Cédula transportista  |
| `placa`                           | string | ✅          | Placa del vehículo        |

---

## Campos del Destinatario

| Campo                            | Tipo   | Obligatorio | Descripción             |
| -------------------------------- | ------ | ----------- | ----------------------- |
| `tipoIdentificacionDestinatario` | string | ✅          | Código tipo ID          |
| `identificacionDestinatario`     | string | ✅          | Número identificación   |
| `razonSocialDestinatario`        | string | ✅          | Razón social            |
| `dirDestinatario`                | string | ✅          | Dirección destino       |
| `emailDestinatario`              | string | ❌          | Email para notificación |
| `motivoTraslado`                 | string | ✅          | Motivo del traslado     |
| `codDocSustento`                 | string | ❌          | Código doc. sustento    |
| `numDocSustento`                 | string | ❌          | Número doc. sustento    |
| `fechaEmisionDocSustento`        | string | ❌          | Fecha doc. sustento     |

---

## Campos del Detalle

| Campo             | Tipo   | Obligatorio | Descripción              |
| ----------------- | ------ | ----------- | ------------------------ |
| `codigoInterno`   | string | ✅          | Código del producto      |
| `codigoAdicional` | string | ❌          | Código auxiliar          |
| `descripcion`     | string | ✅          | Descripción del producto |
| `cantidad`        | number | ✅          | Cantidad a transportar   |

---

## Tipos de Identificación

| Código | Descripción      |
| ------ | ---------------- |
| `04`   | RUC              |
| `05`   | Cédula           |
| `06`   | Pasaporte        |
| `07`   | Consumidor Final |

---

## Ejemplo Completo

Ver [ejemplos/guia-remision.json](./ejemplos/guia-remision.json)
