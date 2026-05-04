# Configuración del Proyecto

## Variables de Entorno

### Configuración Principal

| Variable       | Descripción              | Ejemplo                      |
| -------------- | ------------------------ | ---------------------------- |
| `NODE_ENV`     | Ambiente de Node.js      | `development` / `production` |
| `PORT`         | Puerto del servidor      | `3001`                       |
| `PUBLIC_URL`   | URL pública de la API    | `https://api.dominio.com`    |

### Base de Datos (PostgreSQL)

| Variable                    | Descripción                         | Obligatorio |
| --------------------------- | ----------------------------------- | ----------- |
| `DB_HOST`                   | Host de PostgreSQL                  | ✅          |
| `DB_PORT`                   | Puerto de PostgreSQL                | ✅          |
| `DB_NAME`                   | Nombre de la base de datos          | ✅          |
| `DB_USER`                   | Usuario de la base de datos         | ✅          |
| `DB_PASSWORD`               | Contraseña de la base de datos      | ✅          |
| `DB_SSL`                    | Habilitar SSL para la conexión      | ❌          |
| `DB_POOL_MAX`               | Máx. conexiones en el pool          | ❌          |
| `DB_SLOW_QUERY_THRESHOLD_MS`| Umbral para loguear queries lentas  | ❌          |

### Redis (BullMQ + Cache)

| Variable             | Descripción                | Obligatorio |
| -------------------- | -------------------------- | ----------- |
| `REDIS_HOST`         | Host de Redis              | ✅          |
| `REDIS_PORT`         | Puerto de Redis            | ❌          |
| `REDIS_PASSWORD`     | Contraseña de Redis        | ❌          |
| `CACHE_TTL_SECONDS`  | Tiempo de vida de caché    | ❌          |

### Seguridad

| Variable          | Descripción                        | Obligatorio |
| ----------------- | ---------------------------------- | ----------- |
| `JWT_SECRET`      | Semilla para JWT (32+ chars)       | ✅          |
| `ENCRYPTION_KEY`  | Clave AES-256 (32 chars mín.)      | ✅          |
| `ENCRYPTION_SALT` | Salt para cifrado                  | ✅          |

### Carbone (Motor RIDE)

| Variable             | Descripción                  | Obligatorio |
| -------------------- | ---------------------------- | ----------- |
| `CARBONE_API`        | URL del servidor Carbone     | ✅          |
| `CARBONE_DEBUG`      | Habilitar debug de Carbone   | ❌          |
| `CARBONE_CONVERT_TO` | Formato de salida (pdf, etc) | ❌          |

### SRI Ecuador

| Variable                 | Descripción                    | Valores                                |
| ------------------------ | ------------------------------ | -------------------------------------- |
| `SRI_ENVIRONMENT`        | Ambiente del SRI               | `development` (pruebas) / `production` |
| `SRI_RECEPTION_WSDL`     | URL personalizada recepción    | Dejar vacío para usar default          |
| `SRI_AUTHORIZATION_WSDL` | URL personalizada autorización | Dejar vacío para usar default          |

### Directorios

| Variable        | Descripción                       |
| --------------- | --------------------------------- |
| `TEMPLATES_DIR` | Ruta a carpeta de plantillas      |
| `PDFS_DIR`      | Ruta a carpeta de PDFs generados  |
| `CERTS_DIR`     | Ruta a carpeta de certificados P12|
| `XMLS_DIR`      | Ruta a carpeta de XMLs SRI        |

---

## Ambientes SRI

### Pruebas (development)

```
SRI_ENVIRONMENT=development
```

- Endpoint: `celcer.sri.gob.ec`
- Ambiente XML: `1`
- Comprobantes **NO válidos** fiscalmente

### Producción

```
SRI_ENVIRONMENT=production
```

- Endpoint: `cel.sri.gob.ec`
- Ambiente XML: `2`
- Comprobantes **válidos** fiscalmente ⚠️

---

## Ejemplo de Archivo .env

```bash
# Servidor
NODE_ENV=development
PORT=3001
PUBLIC_URL=http://localhost:3001

# Carbone API
CARBONE_API=http://your-carbone-server:3000

# Directorios
TEMPLATES_DIR=../templates
PDFS_DIR=../pdfs
CERTS_DIR=../certs
XMLS_DIR=../xmls

# Base de Datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=db_sri
DB_USER=postgres
DB_PASSWORD=your-password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Seguridad
JWT_SECRET=your-jwt-secret-key-32bytes-here
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# SRI
SRI_ENVIRONMENT=development
```

> **Nota:** Consulta el archivo [.env.example](../.env.example) para la lista completa de variables disponibles.

---

## Archivos de Configuración

| Archivo            | Uso                       |
| ------------------ | ------------------------- |
| `.env.example`     | Plantilla de referencia   |
| `.env.development` | Desarrollo local          |
| `.env.production`  | Producción                |
| `.env.docker`      | Docker con docker-compose |
