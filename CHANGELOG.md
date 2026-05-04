# Changelog

Todos los cambios notables del proyecto **Open API Facturación Electrónica SRI** se documentan en este archivo.

Este formato sigue el estándar [Keep a Changelog](https://keepachangelog.com/es/1.0.0/) y el proyecto adhiere al [Versionado Semántico](https://semver.org/lang/es/).

---

## [Sin publicar]

> Los siguientes cambios están planificados y propuestos para las próximas versiones del proyecto.

---

## [2.0.0] — Propuesta · Portal Multi-Tenant con Dashboard Web

> **Propósito:** Ofrecer una interfaz web completa que permita a los administradores gestionar tenants, emisores, comprobantes y webhooks sin necesidad de consumir la API directamente.

### Añadido

- **Dashboard Web React/Next.js** embebible como módulo estático servido por la propia API NestJS (`/dashboard`).
- **Módulo de Reportes SRI:** generación y descarga de reportes mensuales/anuales en PDF y Excel (totales por tipo de comprobante, por emisor, por rango de fechas).
- **Módulo de Notificaciones por Email:** envío automático del RIDE (PDF) y XML al receptor al momento de la autorización del SRI, usando Nodemailer o Resend.
- **Soporte para Firma en la Nube (HSM):** integración opcional con proveedores de firma remota para no depender de un `.p12` físico.
- **Rate Limiting por Tenant:** cuotas independientes de peticiones por tenant para evitar que un cliente afecte a los demás.
- **Módulo de Auditoría UI:** visualización de los logs de auditoría desde el dashboard con filtros por usuario, acción y fecha.

### Cambiado

- **Autenticación OAuth2 / OpenID Connect:** soporte para login con proveedores externos (Google, Microsoft) además del sistema JWT actual.
- **WebSockets para estado en tiempo real:** reemplazar el polling de estado de comprobantes por notificaciones push via WebSocket al cliente.

### Seguridad

- **2FA (Autenticación de Dos Factores):** soporte TOTP (Google Authenticator) para usuarios SUPERADMIN.
- **Rotación automática de Refresh Tokens:** invalidar el refresh token anterior al emitir uno nuevo (ya parcialmente implementado).

---

## [1.5.0] — Propuesta · Mejoras de Resiliencia y Observabilidad

> **Propósito:** Hacer el sistema más robusto, observable y fácil de operar en producción.

### Añadido

- **Integración con OpenTelemetry:** trazas distribuidas exportadas a Jaeger/Grafana Tempo para monitoreo de latencia en cada fase de emisión.
- **Métricas Prometheus:** endpoint `/metrics` con contadores de comprobantes emitidos/fallidos, latencia de cola BullMQ, y uso de pool de base de datos.
- **Dead Letter Queue (DLQ):** los trabajos de BullMQ que fallen exhaustivamente se mueven a una cola DLQ con alerta por webhook configurable.
- **Circuit Breaker para SRI:** patrón Circuit Breaker en el cliente SOAP para evitar cascada de errores cuando los Web Services del SRI están caídos.
- **Reintentos con Back-off Exponencial:** mejorar la lógica de reintentos (`SRI_MAX_RETRIES`) con retardo exponencial y jitter.
- **Health checks granulares:** separar el endpoint `/status` en `/status/live` (liveness) y `/status/ready` (readiness) para uso con Kubernetes.

### Cambiado

- **Logging estructurado JSON:** reemplazar el logger de NestJS por `pino` con formato JSON para facilitar el indexado en Loki/Elasticsearch.
- **Pool de conexiones PostgreSQL mejorado:** migrar de `pg` directo a `pg-pool` con métricas de saturación del pool.

### Corregido

- **Timeout configurable por tipo de comprobante:** actualmente todos los comprobantes comparten el mismo timeout SOAP; se permitirá configurarlo por tipo.

---

## [1.4.0] — Propuesta · Facturación Masiva y Async Avanzado

> **Propósito:** Soportar volúmenes altos de emisión mediante procesamiento por lotes.

### Añadido

- **Endpoint `POST /sri/emitir/lote`:** recibe un array de hasta 500 comprobantes y los encola automáticamente en BullMQ para procesamiento asíncrono.
- **Endpoint `GET /sri/lote/:loteId`:** consulta el estado de procesamiento de un lote (pendientes, autorizados, fallidos).
- **Priorización de colas BullMQ:** soporte para comprobantes urgentes (`priority: HIGH`) que saltan la cola normal.
- **Exportación de comprobantes autorizados:** endpoint `GET /sri/exportar` para descargar un ZIP con los XMLs y RIDEs de un rango de fechas.

### Cambiado

- **Procesador de colas paralelo:** actualmente el procesador BullMQ es secuencial por tenant; permitir concurrencia configurable.

---

## [1.3.0] — Propuesta · Soporte para Liquidaciones de Compra y Notas de Débito SRI

> **Propósito:** Completar la cobertura de tipos de comprobante soportados por el SRI.

### Añadido

- **Liquidación de Compra (tipo `03`):** nuevo endpoint `POST /sri/liquidacion-compra/emitir`.
- **Comprobante de Retención para Liquidación de Compra:** manejo del caso especial donde la retención referencia una liquidación.
- **Validador de Número de Autorización SRI:** utilitario para verificar la autenticidad de un número de autorización consultando directamente el servicio del SRI.

---

## [1.2.0] — Propuesta · Mejoras de Seguridad y Compliance

> **Propósito:** Robustecer la seguridad del sistema para cumplir estándares empresariales.

### Añadido

- **Módulo de Políticas de Contraseña:** validación de fortaleza, historial de contraseñas usadas, y expiración configurable.
- **IP Allowlisting por Tenant:** cada tenant puede restringir qué IPs pueden consumir su API.
- **Registro de eventos de acceso:** log inmutable de inicios de sesión (IP, user-agent, timestamp) accesible solo por SUPERADMIN.
- **Encriptación de datos sensibles en reposo:** los campos `certificatePassword` y claves de webhook almacenados en BD deben migrarse a cifrado AES-256-GCM (actualmente ya cifrados en memoria; revisar persistencia).

### Cambiado

- **Headers de seguridad adicionales:** `Permissions-Policy`, `Referrer-Policy`, y `Strict-Transport-Security` (HSTS) como parte de la configuración Helmet.
- **Scopes JWT por módulo:** en lugar de roles genéricos, emitir tokens con scopes granulares (`sri:emitir`, `webhooks:read`, `admin:full`).

---

## [1.1.0] — Propuesta · Mejoras de Documentación y DX (Developer Experience)

> **Propósito:** Facilitar la adopción del proyecto por desarrolladores externos.

### Añadido

- **SDK cliente para TypeScript/JavaScript:** paquete NPM auto-generado desde la especificación OpenAPI para facilitar la integración.
- **Colección Postman actualizada automáticamente:** script en CI que sincroniza la colección Postman con la especificación Swagger al hacer merge a `main`.
- **Ejemplos de integración:** carpeta `examples/` con proyectos de demostración para Node.js, PHP y Python.
- **Video tutoriales:** enlace a serie de videos explicando el flujo completo de emisión.
- **Guía de migración:** documento para equipos que migran desde facturación con la librería `datil-py` o `sri-sdk`.

### Cambiado

- **Swagger UI mejorado:** añadir ejemplos de request/response en cada endpoint con casos de éxito y error.
- **Mensajes de error más descriptivos:** mapear los códigos de error del SRI a mensajes en español con sugerencia de solución.

---

## [1.0.0] — 2026-05-04 · Lanzamiento Inicial

> Primera versión publicada en el Repositorio Nacional de Software Público — [Minka Gob Ec](https://minka.gob.ec/angelo_barzola/api-facturacion-electronica-sri).

### Añadido

- **Arquitectura Multitenant completa:** aislamiento por `X-Tenant-ID` con gestión de tenants, emisores, sucursales y puntos de emisión.
- **Firma XAdES-BES:** firma de XMLs con certificado P12 usando `xadesjs` cumpliendo el estándar del SRI Ecuador.
- **Integración SOAP con el SRI:**
  - `RecepcionComprobantesOffline` — envío de comprobantes.
  - `AutorizacionComprobantesOffline` — consulta de autorización.
  - Soporte para ambientes de **pruebas** (`celcer.sri.gob.ec`) y **producción** (`cel.sri.gob.ec`).
- **Comprobantes soportados:**
  - `01` Factura Electrónica
  - `04` Nota de Crédito Electrónica
  - `05` Nota de Débito Electrónica
  - `06` Guía de Remisión Electrónica
  - `07` Comprobante de Retención Electrónico
- **Cola asíncrona BullMQ + Redis:** procesamiento de emisión en background con reintentos automáticos.
- **Sistema de Webhooks:** notificaciones HTTP a URLs configuradas por tenant cuando un comprobante es autorizado/rechazado.
- **Motor RIDE con Carbone.io:** generación de representaciones impresas (PDF) desde plantillas Word/Excel con código QR embebido.
- **Firma digital de PDFs:** módulo de firma de archivos PDF con certificado P12 usando `@signpdf`.
- **Gestión de Certificados P12:** carga, validación de expiración y lectura de metadata del certificado.
- **Autenticación JWT con roles:** sistema completo de autenticación con roles `SUPERADMIN`, `ADMIN`, `USER` y rotación de refresh tokens.
- **Caché Redis:** caché de catalogos y configuraciones con TTL configurable (`CACHE_TTL_SECONDS`).
- **Auditoría:** interceptor global de auditoría para registrar todas las acciones sensibles.
- **Encriptación AES-256:** servicio de cifrado para datos sensibles (contraseñas de certificados, tokens de webhook).
- **Rate Limiting:** throttler global configurable (`THROTTLE_TTL`, `THROTTLE_LIMIT`).
- **Health Checks:** endpoint `/status` con verificación de PostgreSQL, Redis y filesystem.
- **Documentación Swagger interactiva:** disponible en `/api` con autorización JWT persistida.
- **Docker listo para producción:** imagen multi-stage, `docker-compose.yml` para desarrollo y `docker-compose.prod.yml` para servidor.
- **Colección Postman:** `Collection/Api_Facturacion_Sri.json` con todos los endpoints preconfigurados.
- **Catálogos SRI completos:** endpoints `/catalogos/*` con todos los códigos oficiales del SRI (tipos de IVA 15%, formas de pago, tipos de identificación, motivos de traslado, etc.).

### Seguridad

- **Helmet:** headers HTTP de seguridad habilitados por defecto.
- **CORS restringido:** lista blanca de orígenes configurada por variable de entorno.
- **Validación global:** `ValidationPipe` con `whitelist: true` y `forbidNonWhitelisted: true`.
- **Graceful Shutdown:** hooks de cierre correcto para Docker/Kubernetes (`SIGTERM`/`SIGINT`).
- **`.env` no versionado:** el `.gitignore` excluye todos los archivos `.env.*` (excepto `.env.example`).

---

## Autores

- **Angelo Michelle Barzola Villamar** — [angelobarzola05@gmail.com](mailto:angelobarzola05@gmail.com)

## Repositorio

[https://minka.gob.ec/angelo_barzola/api-facturacion-electronica-sri](https://minka.gob.ec/angelo_barzola/api-facturacion-electronica-sri)
