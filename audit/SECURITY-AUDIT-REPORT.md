# Security Audit Report — Open API Facturación SRI

| Field | Value |
|---|---|
| **Project** | open-api-facturacion-sri |
| **Change** | security-audit-sri |
| **Date** | 2026-06-26 |
| **Auditor** | Automated SDD Security Audit |
| **Version** | 1.0 |
| **Classification** | CONFIDENTIAL |

---

## Executive Summary

This security audit assessed the **Open API Facturación SRI** — a NestJS-based multi-tenant electronic invoicing API for Ecuador's SRI (Servicio de Rentas Internas) infrastructure. The application handles digital certificates, XML signing, financial documents, and multi-tenant data isolation.

### Risk Summary

| Severity | Count | Action Required |
|---|---|---|
| **CRITICAL** | 2 | Immediate remediation |
| **HIGH** | 4 | Remediate before production |
| **MEDIUM** | 7 | Plan for next sprint |
| **LOW** | 2 | Accepted/monitor |
| **Total** | **15** | |

### Key Strengths ✅

- **Parameterized SQL queries** throughout — no SQL injection vectors found
- **bcrypt with 12 rounds** for password hashing — strong and current
- **JWT authentication** with global guard and role-based access control
- **Rate limiting** on login endpoint (5/minute per IP)
- **Path traversal protection** in XmlSignerService for certificate loading
- **Multi-tenant access validation** via `validateEmisorAccess()` and `validateRucAccess()`
- **Input validation** via class-validator with whitelist and forbidNonWhitelisted
- **Helmet** enabled for HTTP security headers
- **Atomic secuencial generation** using PostgreSQL upsert — no race conditions
- **SQL identifier sanitization** with regex validation and whitelist approach
- **Webhook secrets** generated with `crypto.randomBytes(24)` — cryptographically secure

### Critical Gaps ❌

1. **Hardcoded superadmin credentials** in database seed — trivial to exploit if deployed as-is
2. **Certificate passwords in cleartext** alongside encrypted versions in the database
3. **Path traversal in certificate service** — not matched by the protection in XmlSignerService
4. **Webhook secrets leaked** in all API responses
5. **No tenant isolation** on `findAll()` methods — data leakage vectors

---

## Methodology

| Phase | Description |
|---|---|
| **Automated Scanning** | npm audit (gitleaks, semgrep, trivy skipped — not installed) |
| **Manual Code Review** | 10 review areas: Auth, XML/SOAP, Certificates, Multi-tenant, Infrastructure, Cryptography, Dependencies, Secrets, Input Validation, Business Logic |
| **Evidence Collection** | 15 findings with code-level evidence, file paths, and line numbers |
| **Scoring** | CVSS 3.1 base scores with OWASP Top 10 2021 and CWE mapping |

### Files Reviewed

| Category | Files |
|---|---|
| Authentication | auth.service.ts, auth.controller.ts, jwt.strategy.ts, jwt-auth.guard.ts, roles.guard.ts, auth.dto.ts |
| XML/SOAP | xml-signer.service.ts, xml-builder.service.ts, sri-soap.client.ts, xml-storage.service.ts |
| Certificates | certificate.service.ts, certificate.controller.ts, signature.service.ts |
| Multi-tenant | tenants.service.ts, emisores.service.ts, sri-repository.service.ts |
| Infrastructure | main.ts, app.module.ts, Dockerfile, docker-compose.yml, docker-compose.prod.yml |
| Cryptography | encryption.service.ts |
| Configuration | configuration.ts, .env.example |
| Database | database.service.ts, init.sql |
| Business Logic | clave-acceso.service.ts, factura.service.ts |
| Webhooks | webhooks.service.ts |

---

## Findings by Severity

### CRITICAL

---

#### EV-001: Hardcoded Superadmin Credentials in Database Seed

| Field | Value |
|---|---|
| **Severity** | CRITICAL |
| **CVSS 3.1** | 9.1 (Critical) |
| **OWASP** | A07:2021 - Identification and Authentication Failures |
| **CWE** | CWE-798 (Use of Hard-coded Credentials) |
| **File** | `database/init.sql` : Line 1015 |

**Description:** The database seed file contains a hardcoded superadmin user with a known bcrypt password hash. If deployed without changing credentials, any attacker can crack the hash and gain full SUPERADMIN access.

**Evidence:**
```sql
INSERT INTO public.usuarios (id, email, password_hash, rol, tenant_id, activo, created_at, updated_at, last_login)
VALUES ('00000000-0000-0000-0000-000000000000', 'superadmin@openapi-sri.com',
  '$2b$12$85teQgrnCqABaMn.DH0b3O8.M3Zk5RhUuZe3J/rqsgBlDqCSVFRKm',
  'SUPERADMIN', NULL, true, now(), now(), NULL) ON CONFLICT DO NOTHING;
```

**Impact:** Full system compromise — SUPERADMIN access to all tenants, certificates, financial documents, and the ability to issue arbitrary electronic invoices.

**Remediation:**
1. Remove the hardcoded seed user from `init.sql`
2. Generate a unique superadmin password at deployment time
3. Force password change on first login
4. Add deployment checklist requiring default credential rotation

---

#### EV-002: Certificate Password Stored in Cleartext Column

| Field | Value |
|---|---|
| **Severity** | CRITICAL |
| **CVSS 3.1** | 8.6 (High) |
| **OWASP** | A02:2021 - Cryptographic Failures |
| **CWE** | CWE-312 (Cleartext Storage of Sensitive Information) |
| **File** | `database/init.sql` : Line 444 |

**Description:** The `emisores` table has a `certificado_password` (text) column that stores P12 certificate passwords in cleartext, alongside the encrypted `certificado_password_encrypted` column. Any database dump or unauthorized query exposes all certificate passwords.

**Evidence:**
```sql
-- init.sql line 444:
certificado_password text,
-- init.sql line 450:
certificado_password_encrypted text,
```

**Impact:** Exposure of all P12 certificate passwords. Attacker with database read access can decrypt all signing certificates and issue fraudulent invoices.

**Remediation:**
1. Migrate all `certificado_password` values to `certificado_password_encrypted` using `EncryptionService`
2. Drop the `certificado_password` column
3. Run a database migration to remove the plaintext column

---

### HIGH

---

#### EV-003: Path Traversal in Certificate Service File Operations

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **CVSS 3.1** | 7.5 (High) |
| **OWASP** | A01:2021 - Broken Access Control |
| **CWE** | CWE-22 (Path Traversal) |
| **File** | `src/modules/certificate/certificate.service.ts` : Line 87 |

**Description:** `CertificateService.certificateExists()`, `deleteCertificate()`, and `getCertificatePath()` use `join(this.certsDir, fileName)` without path containment validation. The controller checks `.p12` extension but not `../` sequences.

**Evidence:**
```typescript
// certificate.service.ts line 87-88 (NO protection):
certificateExists(fileName: string): boolean {
  const filePath = join(this.certsDir, fileName);
  return existsSync(filePath);
}

// xml-signer.service.ts line 74-79 (HAS protection):
const resolvedPath = path.resolve(p12Path);
const certsBaseDir = path.resolve(STORAGE_PATHS.certs);
if (!resolvedPath.startsWith(certsBaseDir)) {
  throw new Error(`Ruta de certificado inválida o no permitida: ${p12Path}`);
}
```

**Impact:** Authenticated attacker could delete or enumerate arbitrary `.p12` files on the server.

**Remediation:** Add `path.resolve()` and `startsWith(certsBaseDir)` validation to all file operations in `CertificateService`, matching the pattern in `XmlSignerService`.

---

#### EV-004: Webhook Secret Exposed in API Responses

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **CVSS 3.1** | 7.2 (High) |
| **OWASP** | A01:2021 - Broken Access Control |
| **CWE** | CWE-200 (Exposure of Sensitive Information) |
| **File** | `src/modules/webhooks/webhooks.service.ts` : Line 63 |

**Description:** All webhook CRUD operations return the `secreto` field. The webhook secret signs HMAC payloads for delivery verification. Exposing it allows forging webhook payloads.

**Evidence:**
```typescript
// webhooks.service.ts line 63 — SELECT includes 'secreto':
let query = `
  SELECT id, nombre, url, eventos, emisor_id, secreto, activo, ...
  FROM webhook_configs
`;

// line 339 — mapToResponse includes secret:
secreto: row.secreto as string,
```

**Impact:** Attacker can forge webhook payloads that appear legitimate, triggering false business events.

**Remediation:**
1. Exclude `secreto` from all read-operation SQL queries
2. Only return the secret once during creation
3. Create a `WebhookResponseDto` that omits the secret

---

#### EV-005: Missing Tenant Isolation on Emisores findAll()

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **CVSS 3.1** | 6.8 (Medium) |
| **OWASP** | A01:2021 - Broken Access Control |
| **CWE** | CWE-862 (Missing Authorization) |
| **File** | `src/modules/emisores/emisores.service.ts` : Line 48 |

**Description:** `EmisoresService.findAll()` returns ALL emisores across ALL tenants without filtering. If any controller uses this method instead of `findAllByTenant()`, cross-tenant data is leaked.

**Evidence:**
```typescript
// emisores.service.ts line 48-60:
async findAll(): Promise<EmisorResponseDto[]> {
  const result = await this.db.query(
    `SELECT ... FROM emisores ORDER BY created_at DESC`
    // No WHERE tenant_id = clause
  );
}
```

**Impact:** Cross-tenant data leakage — a user from Tenant A sees all companies (RUCs, certificate status) from Tenant B.

**Remediation:**
1. Restrict `findAll()` to SUPERADMIN only via `@Roles(UserRole.SUPERADMIN)`
2. Audit all controller routes to ensure they use `findAllByTenant()` or `validateEmisorAccess()`

---

#### EV-006: No Account Lockout After Failed Login Attempts

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **CVSS 3.1** | 6.8 (Medium) |
| **OWASP** | A07:2021 - Identification and Authentication Failures |
| **CWE** | CWE-307 (Improper Restriction of Excessive Authentication Attempts) |
| **File** | `src/modules/auth/auth.controller.ts` : Line 45 |

**Description:** Login has IP-based rate limiting (5/minute) but no account-level lockout. Distributed attacks across multiple IPs bypass the rate limit indefinitely.

**Evidence:**
```typescript
// auth.controller.ts line 45:
@Throttle({ default: { limit: 5, ttl: 60000 } }) // IP-based only
// auth.service.ts: No failed_attempt counter or lock logic
```

**Impact:** Credential brute-force attacks become feasible with IP rotation.

**Remediation:**
1. Add `failed_attempts` and `locked_until` columns to `usuarios` table
2. Lock account for 15 minutes after 5 failed attempts
3. Implement exponential backoff

---

### MEDIUM

---

#### EV-007: CORS Allows Null Origin Requests

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS 3.1** | 6.1 (Medium) |
| **OWASP** | A05:2021 - Security Misconfiguration |
| **CWE** | CWE-942 (Permissive Cross-domain Policy) |
| **File** | `src/main.ts` : Line 43 |

**Description:** CORS configuration allows requests with no Origin header, enabling bypass via sandboxed iframes.

**Evidence:**
```typescript
// main.ts line 43-44:
if (!origin) return callback(null, true); // Allows null origin
```

**Remediation:** Reject null origins in production. Allow only in development.

---

#### EV-008: Security Headers Disabled (Helmet CSP and COEP)

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS 3.1** | 5.3 (Medium) |
| **OWASP** | A05:2021 - Security Misconfiguration |
| **CWE** | CWE-693 (Protection Mechanism Failure) |
| **File** | `src/main.ts` : Line 29 |

**Description:** Helmet is configured with `crossOriginEmbedderPolicy: false` and `contentSecurityPolicy: false`.

**Remediation:** Enable CSP with API-appropriate policy. Use path-specific overrides for Swagger UI.

---

#### EV-009: Database SSL Certificate Verification Disabled

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS 3.1** | 6.5 (Medium) |
| **OWASP** | A07:2021 - Identification and Authentication Failures |
| **CWE** | CWE-295 (Improper Certificate Validation) |
| **File** | `src/database/database.service.ts` : Line 32 |

**Description:** PostgreSQL SSL uses `rejectUnauthorized: false`, enabling MITM attacks.

**Evidence:**
```typescript
ssl: this.configService.get('database.ssl') === 'true'
  ? { rejectUnauthorized: false }
  : undefined,
```

**Remediation:** Set `rejectUnauthorized: true` in production. Provide CA cert via `DB_SSL_CA`.

---

#### EV-010: Swagger UI Always Enabled with Persistent Authorization

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS 3.1** | 5.3 (Medium) |
| **OWASP** | A05:2021 - Security Misconfiguration |
| **CWE** | CWE-200 (Exposure of Sensitive Information) |
| **File** | `src/main.ts` : Line 122 |

**Description:** Swagger UI is unconditionally enabled at `/api` in all environments with `persistAuthorization: true`.

**Remediation:** Disable Swagger in production. Remove `persistAuthorization`.

---

#### EV-011: Refresh Token Not Rotated or Revoked

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS 3.1** | 5.3 (Medium) |
| **OWASP** | A07:2021 - Identification and Authentication Failures |
| **CWE** | CWE-613 (Insufficient Session Expiration) |
| **File** | `src/modules/auth/auth.service.ts` : Line 76 |

**Description:** Refresh tokens are not rotated or revoked. A stolen refresh token provides persistent 7-day access with no revocation mechanism.

**Remediation:** Implement refresh token rotation, add `jti` claim with Redis blacklist, reduce lifetime.

---

#### EV-012: Financial Rounding Uses JavaScript Native toFixed()

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS 3.1** | 4.0 (Medium) |
| **OWASP** | A04:2021 - Insecure Design |
| **CWE** | CWE-682 (Incorrect Calculation) |
| **File** | `src/modules/sri/services/xml-builder.service.ts` : Line 236 |

**Description:** `formatDecimal()` uses `value.toFixed()` (IEEE 754) instead of the `decimal.js` library already in `package.json`.

**Evidence:**
```typescript
// xml-builder.service.ts line 236-238:
private formatDecimal(value: number, decimals: number): string {
  return value.toFixed(decimals); // Uses IEEE 754 — NOT decimal.js
}
```

**Remediation:** Replace `toFixed()` with `decimal.js` for all financial calculations.

---

#### EV-013: XML Parsing Libraries May Allow XXE

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS 3.1** | 5.3 (Medium) |
| **OWASP** | A03:2021 - Injection |
| **CWE** | CWE-611 (Improper Restriction of XML External Entity Reference) |
| **File** | `src/modules/sri/services/xml-signer.service.ts` : Line 156 |

**Description:** `xmldom` DOMParser and `xml2js` Parser do not explicitly configure XXE prevention. Recent versions default to safe, but explicit configuration is a defense-in-depth best practice.

**Remediation:** Explicitly disable external entities in DOMParser and xml2js configuration.

---

### LOW

---

#### EV-014: Static File Serving Exposes PDF and Image Directories

| Field | Value |
|---|---|
| **Severity** | LOW |
| **CVSS 3.1** | 3.7 (Low) |
| **OWASP** | A01:2021 - Broken Access Control |
| **CWE** | CWE-538 (Insertion of Sensitive Information into Externally-Accessible File or Directory) |
| **File** | `src/app.module.ts` : Line 66 |

**Description:** `ServeStaticModule` serves `/pdfs` and `/images` directories without tenant-based access control. Any authenticated user can access files from any tenant.

**Remediation:** Implement signed URLs with expiration for file downloads. Add tenant-based access control.

---

#### EV-015: SHA-1 Used in XML Digital Signatures (Accepted Risk)

| Field | Value |
|---|---|
| **Severity** | LOW |
| **CVSS 3.1** | 3.1 (Low) |
| **OWASP** | A02:2021 - Cryptographic Failures |
| **CWE** | CWE-327 (Use of a Broken or Risky Cryptographic Algorithm) |
| **File** | `src/modules/sri/services/xml-signer.service.ts` : Line 177 |

**Description:** XML signatures use RSA-SHA1, which is cryptographically broken. This is mandated by the SRI Ecuador XAdES-BES standard.

**Status:** ACCEPTED RISK — SRI Regulatory Requirement. Monitor for SRI migration to SHA-256.

---

## Remediation Roadmap

### Immediate (Before Production)

| # | Finding | Effort | Priority |
|---|---|---|---|
| 1 | EV-001: Remove hardcoded superadmin credentials | 1 hour | P0 |
| 2 | EV-002: Drop cleartext certificate password column | 4 hours | P0 |
| 3 | EV-003: Add path traversal protection to CertificateService | 2 hours | P0 |
| 4 | EV-004: Remove webhook secret from API responses | 2 hours | P0 |

### Short-Term (Next Sprint)

| # | Finding | Effort | Priority |
|---|---|---|---|
| 5 | EV-005: Restrict findAll() to SUPERADMIN | 2 hours | P1 |
| 6 | EV-006: Implement account lockout | 8 hours | P1 |
| 7 | EV-009: Enable DB SSL certificate verification | 2 hours | P1 |
| 8 | EV-010: Disable Swagger in production | 1 hour | P1 |

### Medium-Term (Next 30 Days)

| # | Finding | Effort | Priority |
|---|---|---|---|
| 9 | EV-007: Fix CORS null origin handling | 1 hour | P2 |
| 10 | EV-008: Enable Helmet CSP | 2 hours | P2 |
| 11 | EV-011: Implement refresh token rotation | 8 hours | P2 |
| 12 | EV-012: Replace toFixed() with decimal.js | 4 hours | P2 |
| 13 | EV-013: Explicitly configure XXE prevention | 2 hours | P2 |

### Long-Term

| # | Finding | Effort | Priority |
|---|---|---|---|
| 14 | EV-014: Implement signed URLs for file access | 16 hours | P3 |
| 15 | EV-015: Monitor SRI for SHA-256 migration | Ongoing | P3 |

---

## Appendix A: Tool Outputs

### Automated Scans

| Tool | Status | Notes |
|---|---|---|
| gitleaks | SKIPPED | Not installed on audit environment |
| semgrep | SKIPPED | Not installed on audit environment |
| npm audit | COMPLETED | No known vulnerabilities in production dependencies |
| trivy | SKIPPED | Not installed on audit environment |

> **Note:** The manual code review compensated for missing automated tools. For a production audit, install and run all four tools:
> ```bash
> # Install tools
> npm install -g gitleaks
> pip install semgrep
> brew install trivy  # or apt install trivy
>
> # Run the scan pipeline
> ./audit/run-scans.sh
> ```

### Dependency Analysis

Key dependencies reviewed:

| Package | Version | Risk Assessment |
|---|---|---|
| node-forge | ^1.3.3 | ✅ Used for P12 parsing — well-maintained |
| xml2js | ^0.6.2 | ⚠️ Requires explicit XXE configuration |
| xmldom | ^0.6.0 | ⚠️ Ensure latest patch for XXE fixes |
| bcrypt | ^6.0.0 | ✅ Strong — 12 rounds configured |
| passport-jwt | ^4.0.1 | ✅ Standard JWT validation |
| xadesjs | ^2.6.5 | ✅ XAdES-BES implementation for SRI |
| soap | ^1.9.1 | ⚠️ SOAP client — verify no XXE in WSDL parsing |
| @nestjs/throttler | ^6.5.0 | ✅ Rate limiting enabled |

---

## Appendix B: Positive Findings

| Area | Status | Details |
|---|---|---|
| SQL Injection | ✅ SECURE | Parameterized queries everywhere; identifier sanitization with regex |
| Password Hashing | ✅ SECURE | bcrypt with 12 rounds |
| JWT Implementation | ✅ SECURE | Global guard, role-based access, proper token validation |
| Path Traversal (XML) | ✅ SECURE | XmlSignerService has proper path containment |
| Multi-tenant (Emisor) | ✅ SECURE | validateEmisorAccess() and validateRucAccess() with IDOR protection |
| Input Validation | ✅ SECURE | ValidationPipe with whitelist + forbidNonWhitelisted |
| Secuencial Race Conditions | ✅ SECURE | PostgreSQL atomic upsert |
| Webhook Secret Generation | ✅ SECURE | crypto.randomBytes(24) |
| SQL Injection (Bulk) | ✅ SECURE | Column whitelist + identifier regex |
| Graceful Shutdown | ✅ SECURE | enableShutdownHooks() for clean resource cleanup |

---

*Report generated by SDD Security Audit — 2026-06-26*
*Next recommended phase: sdd-verify (confirm findings with evidence)*
