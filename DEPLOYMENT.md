# 🚀 Guía de Despliegue - Open API Facturación SRI

## Índice

- [Arquitectura](#arquitectura)
- [Requisitos](#requisitos)
- [Despliegue Inicial](#despliegue-inicial)
- [Configuración de Nginx](#configuración-de-nginx)
- [Actualización de Versiones](#actualización-de-versiones)
- [Variables de Entorno](#variables-de-entorno)
- [Comandos Útiles](#comandos-útiles)
- [Troubleshooting](#troubleshooting)

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────────────┐
│                         FLUJO DE DESPLIEGUE                      │
└──────────────────────────────────────────────────────────────────┘

  DESARROLLO (Local)                    PRODUCCIÓN (Servidor)
  ─────────────────                     ─────────────────────

  ┌─────────────────┐                   ┌─────────────────────┐
  │  Código Fuente  │                   │   /opt/open-api-facturacion-sri  │
  │  open-api-facturacion-sri/   │                   │                     │
  │                 │                   │  docker-compose.yml │
  │  npm run        │                   │  templates/         │
  │  docker:push    │                   │  pdfs/              │
  └────────┬────────┘                   │  certs/             │
           │                            └──────────┬──────────┘
           ▼                                       │
  ┌─────────────────┐                              │
  │   Docker Hub    │◄─────────────────────────────┘
  │                 │    docker compose pull
  │  angelobarzola/ │
  │  open-api-facturacion-sri    │
  └─────────────────┘
```

### Flujo de Red en Producción

```
Internet → Nginx (80/443) → Docker (3001) → NestJS App
                │
                └─→ Proxy Pass a localhost:3001
```

---

## Requisitos

### En el servidor:

- Docker Engine 24+
- Docker Compose v2+
- Nginx (para proxy reverso)
- Acceso a Docker Hub (login para repositorio privado)

### Verificar instalación:

```bash
docker --version
docker compose version
nginx -v
```

---

## Despliegue Inicial

### Paso 1: Crear estructura de directorios

```bash
# Crear directorio principal
sudo mkdir -p /opt/open-api-facturacion-sri
sudo chown $USER:$USER /opt/open-api-facturacion-sri
cd /opt/open-api-facturacion-sri
```

### Paso 2: Login a Docker Hub

```bash
docker login
# Usuario: angelobarzola
# Password: [tu contraseña de Docker Hub]
```

### Paso 3: Crear docker-compose.prod.yml

```bash
cat > docker-compose.prod.yml << 'EOF'
services:
  open-api-facturacion-sri:
    image: angelobarzola/open-api-facturacion-sri:latest
    container_name: open-api-facturacion-sri
    restart: unless-stopped
    env_file:
      - .env.docker
    ports:
      - "3001:3001"
    volumes:
      - ./templates:/data/templates
      - ./pdfs:/data/pdfs
      - ./certs:/data/certs
      - ./xmls:/data/xmls
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3001/status"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
EOF

# Y crear .env.docker con:
cat > .env.docker <<'EOF'
NODE_ENV=production
PORT=3001
PUBLIC_URL=https://tu-dominio.com
CARBONE_API=http://your-carbone-server:3000
TEMPLATES_DIR=/data/templates
PDFS_DIR=/data/pdfs
CERTS_DIR=/data/certs
XMLS_DIR=/data/xmls
SRI_ENVIRONMENT=production
DB_HOST=tu-host-supabase.supabase.co
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.tu-proyecto
DB_PASSWORD=tu-password-seguro
EOF
```

### Paso 4: Descargar imagen y levantar

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Paso 5: Verificar

```bash
# Ver estado
docker compose -f docker-compose.prod.yml ps

# Ver logs
docker compose -f docker-compose.prod.yml logs -f

# Probar endpoint
curl http://localhost:3001/status
```

---

## Configuración de Nginx

### Crear archivo de configuración

```bash
sudo nano /etc/nginx/sites-available/open-api-facturacion-sri
```

### Contenido (ajustar dominio):

```nginx
server {
    listen 80;
    server_name api.tu-dominio.com;

    # Redirigir a HTTPS (si tienes SSL)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Para subida de archivos grandes
        client_max_body_size 50M;

        # Timeouts para generación de PDFs
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### Habilitar y recargar:

```bash
sudo ln -s /etc/nginx/sites-available/open-api-facturacion-sri /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Actualización de Versiones

### Desde tu máquina local (donde tienes el código):

```bash
# 1. Hacer cambios al código
# 2. Construir y publicar
npm run docker:push
```

### En el servidor:

```bash
cd /opt/open-api-facturacion-sri

# Descargar nueva versión
docker compose -f docker-compose.prod.yml pull

# Reiniciar con nueva versión
docker compose -f docker-compose.prod.yml up -d

# Verificar
docker compose -f docker-compose.prod.yml logs -f
```

---

## Variables de Entorno

| Variable             | Requerida | Descripción                           | Ejemplo                    |
| -------------------- | --------- | ------------------------------------- | -------------------------- |
| `NODE_ENV`           | Sí        | Entorno de ejecución                  | `production`               |
| `PORT`               | Sí        | Puerto interno de la aplicación       | `3001`                     |
| `PUBLIC_URL`         | Sí        | URL pública para generar links        | `https://api.dominio.com`  |
| `CARBONE_API`        | Sí        | URL del servidor Carbone              | `http://your-carbone-server:3000` |
| `TEMPLATES_DIR`      | Sí        | Ruta de templates (en contenedor)     | `/data/templates`          |
| `PDFS_DIR`           | Sí        | Ruta de PDFs (en contenedor)          | `/data/pdfs`               |
| `CERTS_DIR`          | Sí        | Ruta de certificados (en contenedor)  | `/data/certs`              |
| `XMLS_DIR`           | Sí        | Ruta de XMLs SRI (en contenedor)      | `/data/xmls`               |
| `SRI_ENVIRONMENT`    | Sí        | Ambiente SRI (development/production) | `production`               |
| `DB_HOST`            | Sí        | Host de PostgreSQL/Supabase           | `aws.supabase.com`         |
| `DB_PORT`            | Sí        | Puerto de PostgreSQL                  | `6543`                     |
| `DB_NAME`            | Sí        | Nombre de base de datos               | `postgres`                 |
| `DB_USER`            | Sí        | Usuario de base de datos              | `postgres.proyecto`        |
| `DB_PASSWORD`        | Sí        | Password de base de datos             | `****`                     |
| `CARBONE_DEBUG`      | No        | Habilitar debug de Carbone            | `false`                    |
| `CARBONE_CONVERT_TO` | No        | Formato de salida por defecto         | `pdf`                      |
| `CARBONE_LANG`       | No        | Idioma para formateo                  | `en-US`                    |

---

## Comandos Útiles

### Docker Compose

| Comando                                             | Descripción             |
| --------------------------------------------------- | ----------------------- |
| `docker compose -f docker-compose.prod.yml up -d`   | Iniciar en background   |
| `docker compose -f docker-compose.prod.yml down`    | Detener y eliminar      |
| `docker compose -f docker-compose.prod.yml restart` | Reiniciar               |
| `docker compose -f docker-compose.prod.yml logs -f` | Ver logs en tiempo real |
| `docker compose -f docker-compose.prod.yml ps`      | Ver estado              |
| `docker compose -f docker-compose.prod.yml pull`    | Descargar última imagen |

### Docker

| Comando                          | Descripción                |
| -------------------------------- | -------------------------- |
| `docker exec -it open-api-facturacion-sri sh` | Entrar al contenedor       |
| `docker stats open-api-facturacion-sri`       | Ver uso de recursos        |
| `docker system prune -a`         | Limpiar imágenes no usadas |

---

## Troubleshooting

### Error: Permission denied

```bash
# Si hay problemas de permisos en volúmenes
sudo chown -R 1001:1001 templates pdfs certs
# O dar permisos amplios
sudo chmod -R 777 templates pdfs certs
```

### Error: Port already in use

```bash
# Ver qué usa el puerto
sudo lsof -i :3001
# Matar proceso si es necesario
sudo kill -9 <PID>
```

### Contenedor se reinicia constantemente

```bash
# Ver logs para identificar el error
docker compose -f docker-compose.prod.yml logs --tail=50
```

### Limpiar todo y empezar de nuevo

```bash
docker compose -f docker-compose.prod.yml down
docker system prune -a
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## Estructura Final en Servidor

```
/opt/open-api-facturacion-sri/
├── docker-compose.prod.yml    # Configuración de Docker
├── .env.docker                # Variables de entorno
├── templates/                  # Archivos de plantillas
│   ├── template1.docx
│   └── template2.xlsx
├── pdfs/                       # PDFs generados
│   ├── con_firma/             # PDFs firmados
│   ├── others/                # PDFs sin firma
│   ├── documents/             # Otros documentos
│   └── images/                # Imágenes
├── certs/                      # Certificados P12
│   └── certificado.p12
└── xmls/                       # XMLs de comprobantes SRI
    └── 0924383631001/          # Por RUC del emisor
        └── 2026/01/            # Por año/mes
```

---

## Endpoints Disponibles

### Generación PDF

| Método | Endpoint                                   | Descripción             |
| ------ | ------------------------------------------ | ----------------------- |
| GET    | `/status`                                  | Estado del servidor     |
| GET    | `/api`                                     | Documentación Swagger   |
| GET    | `/templates`                               | Listar templates        |
| POST   | `/templates/upload`                        | Subir template          |
| POST   | `/generate-pdf/download/:templateId`       | Generar y descargar PDF |
| POST   | `/generate-pdf/save/:templateId`           | Generar y guardar PDF   |
| POST   | `/signature/sign-pdf/:fileName`            | Firmar PDF existente    |
| POST   | `/signature/generate-sign-pdf/:templateId` | Generar y firmar        |
| GET    | `/certificates/list-certs`                 | Listar certificados     |
| POST   | `/certificates/upload-cert`                | Subir certificado P12   |

### SRI - Facturación Electrónica Ecuador

| Método | Endpoint                              | Descripción              |
| ------ | ------------------------------------- | ------------------------ |
| POST   | `/sri/factura`                        | Emitir Factura           |
| POST   | `/sri/nota-credito`                   | Emitir Nota de Crédito   |
| POST   | `/sri/nota-debito`                    | Emitir Nota de Débito    |
| POST   | `/sri/retencion`                      | Emitir Retención         |
| POST   | `/sri/guia-remision`                  | Emitir Guía de Remisión  |
| GET    | `/sri/comprobantes`                   | Listar comprobantes      |
| GET    | `/sri/comprobantes/:claveAcceso`      | Detalle de comprobante   |
| GET    | `/sri/comprobantes/:claveAcceso/xml`  | Descargar XML autorizado |
| GET    | `/sri/verificar/:claveAcceso`         | Consultar estado en SRI  |
| POST   | `/sri/sincronizar`                    | Sincronizar comprobantes |
| POST   | `/sri/comprobantes/:clave/reintentar` | Reintentar comprobante   |
| PATCH  | `/sri/comprobantes/:clave/anular`     | Anular comprobante local |

### Catálogos SRI

| Método | Endpoint                          | Descripción                 |
| ------ | --------------------------------- | --------------------------- |
| GET    | `/catalogos/impuestos`            | Catálogo de impuestos (IVA) |
| GET    | `/catalogos/retenciones`          | Códigos de retención        |
| GET    | `/catalogos/formas-pago`          | Formas de pago              |
| GET    | `/catalogos/tipos-identificacion` | Tipos de identificación     |
| GET    | `/catalogos/documentos-sustento`  | Documentos sustento         |
| GET    | `/catalogos/motivos-traslado`     | Motivos traslado (Guía)     |
