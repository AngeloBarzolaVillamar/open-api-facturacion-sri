# Documentación del Proyecto — Open API Facturación SRI

Este directorio contiene la documentación técnica completa del sistema de facturación electrónica para Ecuador (SRI).

## 📚 Contenido

| Documento                              | Descripción                                       |
| -------------------------------------- | ------------------------------------------------- |
| [Configuración](./configuracion.md)    | Variables de entorno y configuración del proyecto |
| [API SRI](./api-sri.md)                | Endpoints de facturación electrónica              |
| [Guía de Remisión](./guia-remision.md) | Documentación del comprobante de transporte       |
| [Nota de Crédito](./nota-credito.md)   | Documentación de notas de crédito                 |
| [Nota de Débito](./nota-debito.md)     | Documentación de notas de débito                  |
| [Retenciones](./retenciones.md)        | Documentación de comprobantes de retención        |
| [Base de Datos](./base-datos.md)       | Esquema y estructura de tablas                    |
| [Catálogos SRI](./catalogos.md)        | Códigos y catálogos del SRI                       |

## 🚀 Quick Start

```bash
# Desarrollo
npm run start:dev

# Producción (Docker)
docker-compose -f docker-compose.prod.yml up -d
```

## 🔗 Enlaces Rápidos

- [README Principal](../README.md)
- [Guía de Despliegue](../DEPLOYMENT.md)
- [Swagger API](http://localhost:3001/api)
