# Open API Facturación SRI 🇪🇨

**Motor API RESTful Multitenant para Facturación Electrónica en Ecuador.**

Open API Facturación SRI es una solución de grado "Enterprise" desarrollada en NestJS que actúa como el puente definitivo (Core) entre tus sistemas de venta (ERP, POS) y el Servicio de Rentas Internas (SRI). Integración de todo el flujo: transmisión SOAP, firma XAdES, webhooks y generación de RIDE.

![NestJS](https://img.shields.io/badge/NestJS-11.0-red)
![Node](https://img.shields.io/badge/Node-22-green)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 📋 Funcionalidades Core

- 🏢 **Arquitectura Multitenant:** Maneja múltiples emisores (empresas), sucursales y puntos de emisión desde una sola instancia.
- 🔐 **Firma XML XAdES-BES:** Cumple estrictamente con el estándar del SRI para comprobantes electrónicos usando P12.
- 📡 **Integración Nativa SRI (SOAP):** Comunicación directa con los integradores del Web Service del SRI.
- ⚡ **Webhooks Integrados:** Notificaciones asíncronas para actualizar tus sistemas cuando un comprobante es autorizado.
- 📄 **Motor RIDE Dinámico (Carbone.io):** Diseña plantillas en Word/Excel, inyecta la data y auto-genera el Código QR en PDF.
- 🔑 **API Documentada y Containerizada:** Swagger incluido y listo para orquestadores Docker en producción.

---

## 🚀 Inicio Rápido

### Requisitos

- Node.js 22+
- npm 10+
- Docker (opcional, para despliegue)

### Instalación

```bash
# Clonar repositorio
git clone https://minka.gob.ec/angelo_barzola/api-facturacion-electronica-sri.git
cd api-facturacion-electronica-sri

# Instalar dependencias
npm install
```

### Configuración

Crear archivo `.env` en la raíz del proyecto:

```env
# Requeridas
PORT=3001
PUBLIC_URL=http://localhost:3001
CARBONE_API=http://your-carbone-server:3000
TEMPLATES_DIR=../templates
PDFS_DIR=../pdfs
CERTS_DIR=../certs

# Opcionales
NODE_ENV=development
CARBONE_DEBUG=true
CARBONE_CONVERT_TO=pdf
CARBONE_LANG=en-US
```

### Ejecución

```bash
# Desarrollo (con hot-reload)
npm run start:dev

# Producción
npm run build
npm run start:prod
```

La API estará disponible en `http://localhost:3001`  
Documentación Swagger interactiva en `http://localhost:3001/api`

---

## 👑 Acceso Superadmin y Autenticación

El sistema incluye seguridad por JWT con roles (`SUPERADMIN`, `ADMIN`, `USER`) y aislamiento Multi-Tenant. 

Al levantar la base de datos (mediante `database/init.sql`), se crea automáticamente un usuario administrador global:

- **Email:** `superadmin@openapi-sri.com`
- **Contraseña:** `Admin123!`

### ⚠️ Importante para Producción
1. Inicia sesión usando el endpoint `POST /auth/login`.
2. Utiliza el endpoint `PATCH /auth/change-password` inmediatamente para cambiar la contraseña por defecto.
3. Como `SUPERADMIN`, puedes crear `tenants` (empresas) y registrar nuevos usuarios (endpoint `POST /auth/register`) asignándolos a sus respectivos `tenantId`.

Para cambiar la contraseña directamente en la base de datos, puedes generar un hash de bcrypt usando:
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('TuPasswordSegura', 12).then(console.log);"
```

---

## 📁 Estructura del Proyecto

```
open-api-facturacion-sri/
├── src/
│   ├── common/
│   │   ├── filters/          # Filtros de excepciones
│   │   ├── interfaces/       # Interfaces TypeScript
│   │   └── utils/            # Utilidades (storage-paths, file.utils)
│   ├── config/
│   │   └── configuration.ts  # Configuración centralizada
│   ├── modules/
│   │   ├── certificate/      # Gestión de certificados P12
│   │   ├── document/         # Generación multi-formato
│   │   ├── image/            # Gestión de imágenes
│   │   ├── pdf/              # Generación de PDFs
│   │   ├── signature/        # Firma digital
│   │   ├── status/           # Estado del servidor
│   │   └── template/         # Gestión de plantillas
│   ├── app.module.ts         # Módulo principal
│   └── main.ts               # Punto de entrada
├── Dockerfile                # Imagen de producción
├── Dockerfile.dev            # Imagen de desarrollo
├── docker-compose.yml        # Compose local
├── docker-compose.prod.yml   # Compose producción
└── DEPLOYMENT.md             # Guía de despliegue
```

---

## 🛠️ Scripts Disponibles

| Comando                | Descripción                   |
| ---------------------- | ----------------------------- |
| `npm run start:dev`    | Desarrollo con hot-reload     |
| `npm run start:prod`   | Producción                    |
| `npm run build`        | Compilar TypeScript           |
| `npm run lint`         | Ejecutar ESLint               |
| `npm run format`       | Formatear código con Prettier |
| `npm run test`         | Ejecutar tests                |
| `npm run docker:build` | Construir imagen Docker       |
| `npm run docker:push`  | Publicar a Docker Hub         |
| `npm run docker:up`    | Levantar con docker-compose   |
| `npm run docker:down`  | Detener contenedor            |
| `npm run docker:logs`  | Ver logs del contenedor       |

---

## 🐳 Docker

### Desarrollo local con Docker

```bash
npm run docker:dev
```

### Producción con Docker

```bash
# Construir y publicar imagen
npm run docker:push

# O manualmente
docker build -t angelobarzola/open-api-facturacion-sri:latest .
docker push angelobarzola/open-api-facturacion-sri:latest
```

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para guía completa de despliegue.

---

## 🔌 API Endpoints (Resumen)
*Para la documentación completa y detallada, visita la ruta `/api` (Swagger).*

### Autenticación (OAuth2)

| Método | Endpoint | Descripción |
| ------ | -------- | ----------- |
| POST | `/auth/login` | Iniciar sesión (Retorna access_token y refresh_token) |
| POST | `/auth/refresh` | Refrescar sesión (Rotación de tokens) |
| POST | `/auth/register` | Crear nuevo usuario (Requiere rol SUPERADMIN) |
| PATCH | `/auth/change-password` | Cambiar contraseña actual |

### SRI - Emisión de Comprobantes Electrónicos

| Método | Endpoint | Descripción |
| ------ | -------- | ----------- |
| POST | `/sri/factura/emitir` | Flujo completo 3-fases: Reservar, Firmar, Enviar SRI, Encolar, DB |
| POST | `/sri/nota-credito/emitir`| Emitir Nota de Crédito Electrónica |
| POST | `/sri/nota-debito/emitir` | Emitir Nota de Débito Electrónica |
| POST | `/sri/retencion/emitir` | Emitir Comprobante de Retención Electrónico |
| POST | `/sri/guia-remision/emitir`| Emitir Guía de Remisión Electrónica |

### Webhooks y Colas (BullMQ)

| Método | Endpoint | Descripción |
| ------ | -------- | ----------- |
| GET | `/webhooks` | Listar webhooks registrados del Tenant |
| POST | `/webhooks` | Registrar nueva URL para recibir eventos SRI |
| GET | `/webhooks/logs` | Ver historial de notificaciones (Paginado) |

### Status

| Método | Endpoint  | Descripción           |
| ------ | --------- | --------------------- |
| GET    | `/status` | Estado del servidor   |
| GET    | `/api`    | Documentación Swagger |

### Templates (Carbone)

| Método | Endpoint               | Descripción       |
| ------ | ---------------------- | ----------------- |
| GET    | `/templates`           | Listar templates  |
| POST   | `/templates/upload`    | Subir template    |
| DELETE | `/templates/:fileName` | Eliminar template |

### Generación de PDFs

| Método | Endpoint                                         | Descripción         |
| ------ | ------------------------------------------------ | ------------------- |
| POST   | `/generate-pdf/download/:templateId`             | Generar y descargar |
| POST   | `/generate-pdf/save/:templateId`                 | Generar y guardar   |
| POST   | `/generate-pdf/with-images/download/:templateId` | Con imágenes        |
| GET    | `/generate-pdf/list/:type`                       | Listar PDFs         |

### Firma Digital

| Método | Endpoint                                        | Descripción               |
| ------ | ----------------------------------------------- | ------------------------- |
| POST   | `/signature/sign-pdf/:fileName`                 | Firmar PDF existente      |
| POST   | `/signature/generate-sign-pdf/:templateId`      | Generar y firmar          |
| POST   | `/signature/generate-sign-pdf/save/:templateId` | Generar, firmar y guardar |

### Certificados

| Método | Endpoint                           | Descripción           |
| ------ | ---------------------------------- | --------------------- |
| GET    | `/certificates/list-certs`         | Listar certificados   |
| POST   | `/certificates/upload-cert`        | Subir certificado P12 |
| DELETE | `/certificates/:fileName`          | Eliminar certificado  |
| POST   | `/certificates/info/:fileName`     | Info del certificado  |
| POST   | `/certificates/validate/:fileName` | Validar expiración    |

### Imágenes

| Método | Endpoint            | Descripción     |
| ------ | ------------------- | --------------- |
| GET    | `/images/list`      | Listar imágenes |
| POST   | `/images/upload`    | Subir imagen    |
| DELETE | `/images/:fileName` | Eliminar imagen |

---

## ⚙️ Variables de Entorno

### Requeridas

| Variable        | Descripción                | Ejemplo                    |
| --------------- | -------------------------- | -------------------------- |
| `PORT`          | Puerto de la aplicación    | `3001`                     |
| `PUBLIC_URL`    | URL pública                | `https://api.dominio.com`  |
| `JWT_SECRET`    | Semilla de JWT             | `super-secret-key-32b!!`   |
| `ENCRYPTION_KEY`| AES-256 (32 chars min)     | `sri-module-secret-key-32b`|
| `DB_HOST`       | Host de PostgreSQL         | `localhost`                |
| `REDIS_HOST`    | Host de Redis              | `localhost`                |

### Opcionales (Tunning y Escalabilidad)

| Variable             | Default       | Descripción                |
| -------------------- | ------------- | -------------------------- |
| `NODE_ENV`           | `development` | Entorno                    |
| `DB_POOL_MAX`        | `10`          | Max conexiones DB Pool     |
| `DB_SLOW_QUERY_THRESHOLD_MS` | `1000` | Umbral para loguear Query lenta |
| `CACHE_TTL_SECONDS`  | `300`         | Tiempo de vida de caché Redis|
| `SRI_REQUEST_DELAY_MS` | `150`       | Rate Limiting hacia SRI    |
| `CARBONE_DEBUG`      | `false`       | Debug de Carbone           |
| `CARBONE_CONVERT_TO` | `pdf`         | Formato de salida          |
| `PDF_MAX_ATTEMPTS`   | `2`           | Reintentos de generación   |

---

## 📝 Ejemplo de Uso

### Generar PDF desde template

```bash
curl -X POST http://localhost:3001/generate-pdf/download/template.docx \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "nombre": "Juan Pérez",
      "fecha": "2026-01-02"
    }
  }' \
  --output documento.pdf
```

### Generar y firmar PDF

```bash
curl -X POST http://localhost:3001/signature/generate-sign-pdf/template.docx \
  -H "Content-Type: application/json" \
  -d '{
    "data": { "nombre": "Juan Pérez" },
    "certificateFile": "certificado.p12",
    "certificatePassword": "password123",
    "qrContent": "https://verificar.dominio.com/abc123"
  }' \
  --output documento_firmado.pdf
```

---

## 🔧 Desarrollo

### Agregar nuevo módulo

```bash
nest generate module modules/nuevo-modulo
nest generate controller modules/nuevo-modulo
nest generate service modules/nuevo-modulo
```

### Ejecutar tests

```bash
npm run test
npm run test:watch
npm run test:cov
```

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Haz un fork del repositorio.
2. Crea una rama para tu feature (`git checkout -b feature/mi-feature`).
3. Realiza tus cambios y haz commit (`git commit -m 'Agrega mi feature'`).
4. Sube tu rama (`git push origin feature/mi-feature`).
5. Abre un **Merge Request** en [Minka Gob Ec](https://minka.gob.ec/angelo_barzola/api-facturacion-electronica-sri).

---

## 📄 Licencia

Licencia MIT — Open Source. Todos pueden usar, modificar y distribuir.
Ver el archivo [LICENSE](./LICENSE) para más detalles.

---

## 📬 Contacto

- **Autor:** Angelo Michelle Barzola Villamar
- **Correo:** angelobarzola05@gmail.com
- **Repositorio:** [Minka Gob Ec — API Facturación Electrónica SRI](https://minka.gob.ec/angelo_barzola/api-facturacion-electronica-sri)
