# API de Facturación Electrónica SRI

## Base URL

```
http://localhost:3001/sri
```

---

## Endpoints Principales

### Facturas

| Método | Endpoint                     | Descripción                |
| ------ | ---------------------------- | -------------------------- |
| `POST` | `/emitir/factura`            | Emitir factura electrónica |
| `GET`  | `/facturas`                  | Listar facturas            |
| `GET`  | `/facturas/:claveAcceso`     | Obtener factura por clave  |
| `GET`  | `/facturas/:claveAcceso/xml` | Descargar XML              |

### Notas de Crédito

| Método | Endpoint               | Descripción            |
| ------ | ---------------------- | ---------------------- |
| `POST` | `/emitir/nota-credito` | Emitir nota de crédito |

### Notas de Débito

| Método | Endpoint              | Descripción           |
| ------ | --------------------- | --------------------- |
| `POST` | `/emitir/nota-debito` | Emitir nota de débito |

### Guías de Remisión

| Método | Endpoint                | Descripción             |
| ------ | ----------------------- | ----------------------- |
| `POST` | `/emitir/guia-remision` | Emitir guía de remisión |

### Retenciones

| Método | Endpoint            | Descripción                     |
| ------ | ------------------- | ------------------------------- |
| `POST` | `/emitir/retencion` | Emitir comprobante de retención |

### Utilidades

| Método | Endpoint                   | Descripción                 |
| ------ | -------------------------- | --------------------------- |
| `GET`  | `/verificar/:claveAcceso`  | Verificar estado en SRI     |
| `POST` | `/reintentar/:claveAcceso` | Reintentar autorización     |
| `POST` | `/anular/:claveAcceso`     | Anular comprobante          |
| `POST` | `/sincronizar-pendientes`  | Sincronizar lote pendientes |

### Catálogos

| Método | Endpoint                          | Descripción             |
| ------ | --------------------------------- | ----------------------- |
| `GET`  | `/catalogos/tipos-identificacion` | Tipos de identificación |
| `GET`  | `/catalogos/tipos-comprobante`    | Tipos de comprobante    |
| `GET`  | `/catalogos/formas-pago`          | Formas de pago          |
| `GET`  | `/catalogos/tarifas-iva`          | Tarifas IVA             |
| `GET`  | `/catalogos/motivos-traslado`     | Motivos de traslado     |

---

## Códigos de Comprobante

| Código | Tipo                     |
| ------ | ------------------------ |
| `01`   | Factura                  |
| `04`   | Nota de Crédito          |
| `05`   | Nota de Débito           |
| `06`   | Guía de Remisión         |
| `07`   | Comprobante de Retención |

---

## Estados de Comprobante

| Estado          | Descripción                            |
| --------------- | -------------------------------------- |
| `PENDIENTE`     | Creado, pendiente de enviar            |
| `RECIBIDO`      | Enviado al SRI, esperando autorización |
| `AUTORIZADO`    | Autorizado por el SRI ✅               |
| `NO_AUTORIZADO` | Rechazado por el SRI                   |
| `IRRECUPERABLE` | Error no recuperable                   |
| `ANULADO`       | Anulado por el usuario                 |

---

## Ejemplo: Emitir Factura

```bash
curl -X POST http://localhost:3001/sri/emitir/factura \
  -H "Content-Type: application/json" \
  -d '{
    "fechaEmision": "30/01/2026",
    "emisor": {
      "ruc": "0924383631001",
      "razonSocial": "MI EMPRESA",
      "nombreComercial": "COMERCIAL",
      "dirMatriz": "Guayaquil",
      "dirEstablecimiento": "Local 1",
      "establecimiento": "001",
      "puntoEmision": "001",
      "obligadoContabilidad": "SI"
    },
    "comprador": {
      "tipoIdentificacion": "05",
      "identificacion": "0926789017",
      "razonSocial": "CLIENTE PRUEBA"
    },
    "detalles": [
      {
        "codigoPrincipal": "001",
        "descripcion": "Producto de prueba",
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
    ],
    "pagos": [
      {
        "formaPago": "01",
        "total": 115.00
      }
    ]
  }'
```

---

## Respuesta Exitosa

```json
{
  "success": true,
  "claveAcceso": "3001202601092438363100110010010000000200123456789",
  "estado": "AUTORIZADO",
  "fechaAutorizacion": "2026-01-30T21:30:00.000Z",
  "numeroAutorizacion": "3001202601092438363100110010010000000200123456789",
  "xmlAutorizado": "<?xml version=\"1.0\"...",
  "mensajes": []
}
```
