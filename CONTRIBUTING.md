# Guía de Contribución — Open API Facturación Electrónica SRI

¡Gracias por tu interés en contribuir a este proyecto! 🎉  
Este es un software público del Ecuador publicado en [Minka Gob Ec](https://minka.gob.ec/angelo_barzola/api-facturacion-electronica-sri) y toda colaboración es bienvenida.

---

## 📋 Tabla de Contenidos

- [Código de Conducta](#código-de-conducta)
- [¿Cómo Puedo Contribuir?](#cómo-puedo-contribuir)
- [Configuración del Entorno de Desarrollo](#configuración-del-entorno-de-desarrollo)
- [Flujo de Trabajo con Git](#flujo-de-trabajo-con-git)
- [Convenciones de Commits](#convenciones-de-commits)
- [Estándares de Código](#estándares-de-código)
- [Pruebas](#pruebas)
- [Reportar Bugs](#reportar-bugs)
- [Proponer Nuevas Funcionalidades](#proponer-nuevas-funcionalidades)
- [Contacto](#contacto)

---

## Código de Conducta

Este proyecto se adhiere a los principios del software público: transparencia, colaboración y respeto. Se espera que todos los contribuidores mantengan un ambiente inclusivo y profesional.

- **Sé respetuoso:** Trata a todos con cortesía, independientemente de su nivel de experiencia.
- **Sé constructivo:** Las críticas deben estar orientadas al código, no a la persona.
- **Sé claro:** Documenta bien tus cambios para que otros puedan entenderlos fácilmente.

---

## ¿Cómo Puedo Contribuir?

Hay varias formas de colaborar con el proyecto:

| Tipo de Contribución | Cómo hacerlo |
|----------------------|-------------|
| 🐛 Reportar un bug | Abre un [Issue](https://minka.gob.ec/angelo_barzola/api-facturacion-electronica-sri/-/issues) |
| 💡 Proponer una mejora | Abre un Issue con la etiqueta `enhancement` |
| 🔧 Corregir un bug | Crea un Merge Request (MR) |
| ✨ Añadir una funcionalidad | Crea un MR (discútelo primero en un Issue) |
| 📖 Mejorar documentación | Crea un MR con los cambios en `docs/` o `README.md` |
| 🌍 Traducir documentación | Abre un Issue para coordinar |
| 🧪 Añadir tests | Crea un MR con nuevos tests en `test/` o `*.spec.ts` |

---

## Configuración del Entorno de Desarrollo

### Requisitos previos

- **Node.js** 22 o superior
- **npm** 10 o superior
- **Docker** y **Docker Compose** (para Redis y bases de datos)
- **Git** 2.30+
- Acceso a un servidor **Carbone** (para tests del módulo PDF)
- **PostgreSQL** 14+ (local o Supabase)

### Pasos para empezar

```bash
# 1. Haz fork del repositorio en Minka Gob Ec y clona tu fork
git clone https://minka.gob.ec/<tu-usuario>/api-facturacion-electronica-sri.git
cd api-facturacion-electronica-sri

# 2. Añade el repositorio original como upstream
git remote add upstream https://minka.gob.ec/angelo_barzola/api-facturacion-electronica-sri.git

# 3. Instala las dependencias
npm install

# 4. Copia el archivo de entorno y configura tus valores
cp .env.example .env.development
# Edita .env.development con tu configuración local

# 5. Levanta Redis con Docker (necesario para BullMQ y caché)
docker run -d --name open-api-redis -p 6379:6379 redis:7-alpine

# 6. Inicia la aplicación en modo desarrollo
npm run start:dev
```

La API estará disponible en `http://localhost:3001`  
Swagger en `http://localhost:3001/api`

### Verificar que todo funciona

```bash
curl http://localhost:3001/status
```

Respuesta esperada:

```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
```

---

## Flujo de Trabajo con Git

Este proyecto sigue el modelo **Feature Branch Workflow**:

```
main
 └─ feature/nombre-descriptivo
 └─ fix/nombre-del-bug
 └─ docs/seccion-actualizada
 └─ refactor/componente-mejorado
```

### Paso a paso

```bash
# 1. Sincroniza tu fork con el upstream
git fetch upstream
git checkout main
git merge upstream/main

# 2. Crea una rama descriptiva
git checkout -b feature/emision-liquidacion-compra
# o
git checkout -b fix/timeout-soap-retencion

# 3. Realiza tus cambios...

# 4. Ejecuta las verificaciones antes del commit
npm run lint
npm run test

# 5. Haz commit siguiendo las convenciones (ver sección siguiente)
git commit -m "feat(sri): add liquidacion-compra endpoint type 03"

# 6. Sube tu rama a tu fork
git push origin feature/emision-liquidacion-compra

# 7. Abre un Merge Request en Minka desde tu fork al repositorio principal
```

### Criterios para que un MR sea aceptado

- [ ] El código compila sin errores (`npm run build`)
- [ ] El linter no reporta errores (`npm run lint`)
- [ ] Los tests existentes pasan (`npm run test`)
- [ ] Se añaden tests para los nuevos comportamientos
- [ ] La documentación está actualizada (si aplica)
- [ ] El commit sigue las [convenciones](#convenciones-de-commits)
- [ ] No hay datos sensibles (IPs, contraseñas, tokens) hardcodeados
- [ ] El `CHANGELOG.md` ha sido actualizado en la sección `[Sin publicar]`

---

## Convenciones de Commits

Este proyecto usa el estándar [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/):

```
<tipo>(<ámbito>): <descripción corta>

[cuerpo opcional]

[notas al pie opcionales]
```

### Tipos permitidos

| Tipo | Cuándo usarlo |
|------|--------------|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de un bug |
| `docs` | Cambios solo en documentación |
| `style` | Formato, espaciado (sin cambios de lógica) |
| `refactor` | Refactorización sin cambio de comportamiento |
| `test` | Añadir o corregir tests |
| `chore` | Tareas de mantenimiento (deps, config) |
| `perf` | Mejora de rendimiento |
| `ci` | Cambios en CI/CD |
| `build` | Cambios en el sistema de build o Docker |

### Ámbitos sugeridos

`auth` · `sri` · `webhooks` · `pdf` · `signature` · `certificate` · `emisores` · `tenants` · `queue` · `database` · `config` · `docker` · `docs`

### Ejemplos

```bash
# ✅ Correcto
git commit -m "feat(sri): add support for liquidacion-compra document type"
git commit -m "fix(queue): handle SOAP timeout with exponential backoff"
git commit -m "docs(readme): update installation steps for Node 22"
git commit -m "refactor(auth): extract token rotation to dedicated service"
git commit -m "test(clave-acceso): add edge cases for RUC validation"

# ❌ Incorrecto
git commit -m "cambios"
git commit -m "fix stuff"
git commit -m "WIP"
```

---

## Estándares de Código

### TypeScript / NestJS

- Usa **TypeScript estricto** — no usar `any` salvo casos excepcionales documentados.
- Sigue el patrón **Módulo → Servicio → Controlador → DTO** de NestJS.
- Toda lógica de negocio va en **servicios**, no en controladores.
- Los controladores solo hacen **orquestación y validación HTTP**.
- Usa `class-validator` + DTOs para validar todos los inputs.
- No hardcodees URLs, IPs ni credenciales — todo va en variables de entorno.

### Ejemplo de estructura de módulo

```
src/modules/mi-modulo/
├── mi-modulo.module.ts       # Registro de dependencias
├── mi-modulo.controller.ts   # Rutas HTTP y decoradores Swagger
├── mi-modulo.service.ts      # Lógica de negocio
└── dto/
    └── mi-modulo.dto.ts      # Validación de entrada con class-validator
```

### Linter y Formato

El proyecto usa **ESLint** + **Prettier**. Ejecuta antes de cada commit:

```bash
npm run format   # Aplica Prettier automáticamente
npm run lint     # Verifica ESLint (con auto-fix)
```

Puedes configurar tu editor para que lo haga automáticamente al guardar.

### Seguridad del Código

- **No subas archivos `.env`** — están en el `.gitignore`.
- **No subas certificados `.p12`** — mantenlos fuera del repositorio.
- **No expongas claves privadas** en logs ni en respuestas HTTP.
- Si detectas una vulnerabilidad de seguridad, **no abras un Issue público** — escribe directamente a [angelobarzola05@gmail.com](mailto:angelobarzola05@gmail.com).

---

## Pruebas

### Ejecutar el suite completo

```bash
# Todos los tests unitarios
npm run test

# Con cobertura
npm run test:cov

# Modo watch (desarrollo)
npm run test:watch

# Tests end-to-end
npm run test:e2e
```

### Dónde escribir tests

- Tests **unitarios** de servicios: junto al servicio como `*.spec.ts`
  - Ejemplo: `src/modules/sri/services/clave-acceso.service.spec.ts`
- Tests **E2E**: en la carpeta `test/`

### Qué debe tener un buen test

```typescript
describe('ClaveAccesoService', () => {
  // ✅ Describe QUÉ hace, no CÓMO lo hace
  it('debe generar una clave de acceso de 49 dígitos para una factura', () => {
    // Arrange
    const params = { ... };

    // Act
    const result = service.generar(params);

    // Assert
    expect(result).toHaveLength(49);
    expect(result).toMatch(/^\d+$/);
  });

  // ✅ Cubre casos borde
  it('debe lanzar error si el RUC no tiene 13 dígitos', () => {
    expect(() => service.generar({ ruc: '123' })).toThrow();
  });
});
```

---

## Reportar Bugs

Antes de abrir un Issue, por favor:

1. **Verifica** que el bug no ha sido ya reportado en los [Issues existentes](https://minka.gob.ec/angelo_barzola/api-facturacion-electronica-sri/-/issues).
2. **Reproduce** el bug con la versión más reciente del proyecto.
3. **Abre un Issue** usando la plantilla:

```markdown
## Descripción del Bug

Descripción clara y concisa del problema.

## Pasos para Reproducir

1. Configurar variable `X` con valor `Y`
2. Llamar al endpoint `POST /sri/factura/emitir` con el body:
   ```json
   { ... }
   ```
3. Observar el error

## Comportamiento Esperado

Lo que debería ocurrir.

## Comportamiento Actual

Lo que ocurre realmente. Incluye el mensaje de error completo.

## Entorno

- **Versión de Node.js:** `node -v`
- **Sistema Operativo:** Ubuntu 22.04 / Windows 11 / macOS 14
- **Docker:** `docker --version`
- **Ambiente SRI:** pruebas / producción

## Logs Relevantes

```
Pega aquí los logs del contenedor (sin datos sensibles)
```
```

---

## Proponer Nuevas Funcionalidades

1. Consulta primero el [CHANGELOG.md](./CHANGELOG.md) — puede que la funcionalidad ya esté planificada.
2. Abre un Issue con la etiqueta `enhancement` describiendo:
   - **Problema que resuelve:** ¿qué necesidad cubre?
   - **Solución propuesta:** descripción de la implementación.
   - **Alternativas consideradas:** otras formas de resolverlo.
   - **Impacto en la API:** ¿rompe compatibilidad hacia atrás? (`BREAKING CHANGE`)
3. Espera feedback antes de empezar a codificar para evitar trabajo duplicado.

---

## Contacto

Si tienes dudas sobre cómo contribuir o quieres coordinar antes de empezar:

- **Autor:** Angelo Michelle Barzola Villamar
- **Correo:** [angelobarzola05@gmail.com](mailto:angelobarzola05@gmail.com)
- **Issues:** [Minka Gob Ec — Issues](https://minka.gob.ec/angelo_barzola/api-facturacion-electronica-sri/-/issues)

---

*¡Gracias por hacer que la facturación electrónica en Ecuador sea más accesible para todos! 🇪🇨*
