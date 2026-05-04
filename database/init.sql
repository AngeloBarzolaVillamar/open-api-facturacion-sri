--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'SUPERADMIN',
    'ADMIN',
    'USER'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    usuario_email character varying(255),
    tenant_id uuid,
    ip_address inet,
    user_agent text,
    accion character varying(50) NOT NULL,
    recurso character varying(100) NOT NULL,
    recurso_id character varying(255),
    descripcion text,
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    metadata jsonb,
    exitoso boolean DEFAULT true,
    error text,
    duracion_ms integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE auditoria; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.auditoria IS 'Registro de auditoría para trazabilidad legal y técnica de todas las operaciones del sistema';


--
-- Name: COLUMN auditoria.accion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auditoria.accion IS 'Tipo de acción: CREATE, UPDATE, DELETE, LOGIN, EMITIR_FACTURA, SINCRONIZAR_SRI, etc.';


--
-- Name: COLUMN auditoria.recurso; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auditoria.recurso IS 'Tipo de recurso afectado: emisores, comprobantes, webhooks, certificados, usuarios, etc.';


--
-- Name: catalogo_documentos_sustento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_documentos_sustento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(2) NOT NULL,
    descripcion character varying(200) NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: catalogo_formas_pago; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_formas_pago (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(2) NOT NULL,
    descripcion character varying(100) NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: catalogo_impuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_impuestos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(2) NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion character varying(300),
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: catalogo_motivos_traslado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_motivos_traslado (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(2) NOT NULL,
    descripcion character varying(200) NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: catalogo_retenciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_retenciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo character varying(10) NOT NULL,
    codigo character varying(10) NOT NULL,
    descripcion character varying(500) NOT NULL,
    porcentaje numeric(5,2) NOT NULL,
    vigente_desde date DEFAULT CURRENT_DATE NOT NULL,
    vigente_hasta date,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: catalogo_tarifas_impuesto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_tarifas_impuesto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    impuesto_id uuid NOT NULL,
    codigo_porcentaje character varying(4) NOT NULL,
    descripcion character varying(100) NOT NULL,
    porcentaje numeric(5,2) NOT NULL,
    vigente_desde date DEFAULT CURRENT_DATE NOT NULL,
    vigente_hasta date,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: catalogo_tipos_identificacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_tipos_identificacion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(2) NOT NULL,
    descripcion character varying(100) NOT NULL,
    longitud integer,
    regex_validacion character varying(100),
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: comprobante_detalles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comprobante_detalles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    comprobante_id uuid NOT NULL,
    producto_id uuid,
    codigo_principal character varying(25),
    codigo_auxiliar character varying(25),
    descripcion character varying(300) NOT NULL,
    unidad_medida character varying(50),
    cantidad numeric(18,6) NOT NULL,
    precio_unitario numeric(18,6) NOT NULL,
    descuento numeric(18,2) DEFAULT 0,
    precio_total_sin_impuesto numeric(18,2),
    orden integer DEFAULT 0
);


--
-- Name: TABLE comprobante_detalles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.comprobante_detalles IS 'Líneas de detalle de comprobantes';


--
-- Name: comprobante_impuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comprobante_impuestos (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    comprobante_detalle_id uuid NOT NULL,
    codigo character varying(2) NOT NULL,
    codigo_porcentaje character varying(4) NOT NULL,
    tarifa numeric(8,2),
    base_imponible numeric(18,2),
    valor numeric(18,2)
);


--
-- Name: TABLE comprobante_impuestos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.comprobante_impuestos IS 'Impuestos por línea de detalle';


--
-- Name: comprobante_pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comprobante_pagos (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    comprobante_id uuid NOT NULL,
    forma_pago character varying(2) NOT NULL,
    total numeric(18,2) NOT NULL,
    plazo integer,
    unidad_tiempo character varying(20)
);


--
-- Name: TABLE comprobante_pagos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.comprobante_pagos IS 'Formas de pago de comprobantes';


--
-- Name: comprobante_retenciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comprobante_retenciones (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    comprobante_id uuid NOT NULL,
    codigo character varying(2) NOT NULL,
    codigo_retencion character varying(5) NOT NULL,
    base_imponible numeric(18,2),
    porcentaje_retener numeric(8,2),
    valor_retenido numeric(18,2),
    cod_doc_sustento character varying(2),
    num_doc_sustento character varying(20),
    fecha_emision_doc_sustento date,
    total_sin_impuestos numeric(18,2),
    importe_total numeric(18,2),
    pago_loc_ext character varying(2) DEFAULT '01'::character varying
);


--
-- Name: TABLE comprobante_retenciones; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.comprobante_retenciones IS 'Detalles de retenciones';


--
-- Name: comprobante_totales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comprobante_totales (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    comprobante_id uuid NOT NULL,
    codigo character varying(2) NOT NULL,
    codigo_porcentaje character varying(4) NOT NULL,
    descuento_adicional numeric(18,2),
    base_imponible numeric(18,2),
    tarifa numeric(8,2),
    valor numeric(18,2),
    valor_devolucion_iva numeric(18,2)
);


--
-- Name: TABLE comprobante_totales; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.comprobante_totales IS 'Totales de impuestos por comprobante';


--
-- Name: comprobante_xmls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comprobante_xmls (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    comprobante_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    xml_autorizado_path character varying(500),
    xml_firmado_path character varying(500)
);


--
-- Name: TABLE comprobante_xmls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.comprobante_xmls IS 'Rutas a XMLs autorizados almacenados en filesystem. Estructura: {ruc}/{year}/{month}/{claveAcceso}_autorizado.xml';


--
-- Name: COLUMN comprobante_xmls.xml_autorizado_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comprobante_xmls.xml_autorizado_path IS 'Ruta relativa al archivo XML autorizado por el SRI';


--
-- Name: comprobantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comprobantes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    emisor_id uuid NOT NULL,
    punto_emision_id uuid NOT NULL,
    receptor_id uuid,
    tipo_comprobante character varying(2) NOT NULL,
    ambiente character varying(1) NOT NULL,
    tipo_emision character varying(1) DEFAULT '1'::character varying,
    secuencial character varying(9) NOT NULL,
    clave_acceso character varying(49),
    fecha_emision date NOT NULL,
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying,
    estado_sri character varying(20),
    fecha_autorizacion timestamp with time zone,
    numero_autorizacion character varying(49),
    total_sin_impuestos numeric(18,2),
    total_descuento numeric(18,2) DEFAULT 0,
    importe_total numeric(18,2),
    propina numeric(18,2),
    moneda character varying(15) DEFAULT 'DOLAR'::character varying,
    receptor_tipo_identificacion character varying(2),
    receptor_identificacion character varying(20),
    receptor_razon_social character varying(300),
    receptor_direccion text,
    receptor_email character varying(255),
    receptor_telefono character varying(20),
    doc_modificado_tipo character varying(2),
    doc_modificado_numero character varying(20),
    doc_modificado_fecha date,
    motivo text,
    valor_modificacion numeric(18,2),
    rise character varying(40),
    periodo_fiscal character varying(7),
    dir_partida text,
    placa character varying(20),
    ruc_transportista character varying(13),
    razon_social_transportista character varying(300),
    tipo_identificacion_transportista character varying(2),
    fecha_ini_transporte date,
    fecha_fin_transporte date,
    guia_remision character varying(20),
    id_referencia_externa character varying(100),
    tipo_sistema_externo character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE comprobantes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.comprobantes IS 'Tabla principal de comprobantes electrónicos (facturas, NC, ND, retenciones, guías)';


--
-- Name: detalles_adicionales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detalles_adicionales (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    comprobante_detalle_id uuid NOT NULL,
    nombre character varying(100) NOT NULL,
    valor character varying(300) NOT NULL
);


--
-- Name: TABLE detalles_adicionales; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.detalles_adicionales IS 'Detalles adicionales por línea de producto';


--
-- Name: emisores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emisores (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    ruc character varying(13) NOT NULL,
    razon_social character varying(300) NOT NULL,
    nombre_comercial character varying(300),
    direccion_matriz text NOT NULL,
    obligado_contabilidad boolean DEFAULT false,
    contribuyente_especial character varying(20),
    agente_retencion character varying(5),
    contribuyente_rimpe boolean DEFAULT false,
    certificado_p12 bytea,
    certificado_password text,
    ambiente character varying(20) DEFAULT '1'::character varying,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    certificado_nombre character varying(255),
    certificado_password_encrypted text,
    certificado_valido_hasta timestamp with time zone,
    certificado_sujeto text,
    certificado_updated_at timestamp with time zone
);


--
-- Name: TABLE emisores; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.emisores IS 'Empresas emisoras de comprobantes electrónicos';


--
-- Name: COLUMN emisores.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.emisores.tenant_id IS 'ID del tenant (opcional para single-tenant, requerido para multi-tenant)';


--
-- Name: COLUMN emisores.ambiente; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.emisores.ambiente IS 'Ambiente SRI: pruebas o produccion';


--
-- Name: COLUMN emisores.certificado_nombre; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.emisores.certificado_nombre IS 'Nombre del archivo P12 en el filesystem';


--
-- Name: COLUMN emisores.certificado_password_encrypted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.emisores.certificado_password_encrypted IS 'Password del certificado encriptado';


--
-- Name: COLUMN emisores.certificado_valido_hasta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.emisores.certificado_valido_hasta IS 'Fecha de caducidad del certificado';


--
-- Name: COLUMN emisores.certificado_sujeto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.emisores.certificado_sujeto IS 'Subject del certificado (nombre del titular)';


--
-- Name: COLUMN emisores.certificado_updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.emisores.certificado_updated_at IS 'Última actualización del certificado';


--
-- Name: establecimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.establecimientos (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    emisor_id uuid NOT NULL,
    codigo character varying(3) NOT NULL,
    direccion text NOT NULL,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE establecimientos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.establecimientos IS 'Sucursales/establecimientos del emisor';


--
-- Name: guia_destinatarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guia_destinatarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comprobante_id uuid NOT NULL,
    identificacion_destinatario character varying(20) NOT NULL,
    razon_social_destinatario character varying(300) NOT NULL,
    dir_destinatario character varying(300),
    motivo_traslado character varying(300),
    doc_aduanero_unico character varying(20),
    cod_estab_destino character varying(3),
    ruta character varying(300),
    cod_doc_sustento character varying(2),
    num_doc_sustento character varying(17),
    fecha_emision_doc_sustento date,
    num_aut_doc_sustento character varying(49),
    created_at timestamp with time zone DEFAULT now(),
    tipo_identificacion_destinatario character varying(2),
    email_destinatario character varying(255)
);


--
-- Name: COLUMN guia_destinatarios.tipo_identificacion_destinatario; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.guia_destinatarios.tipo_identificacion_destinatario IS 'Tipo de identificación del destinatario (04=RUC, 05=Cédula, 06=Pasaporte, 07=Consumidor Final)';


--
-- Name: COLUMN guia_destinatarios.email_destinatario; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.guia_destinatarios.email_destinatario IS 'Email del destinatario para envío automático del comprobante';


--
-- Name: guia_detalles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guia_detalles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    destinatario_id uuid NOT NULL,
    codigo_interno character varying(25) NOT NULL,
    codigo_adicional character varying(25),
    descripcion character varying(300) NOT NULL,
    cantidad numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: info_adicional; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.info_adicional (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    comprobante_id uuid NOT NULL,
    nombre character varying(100) NOT NULL,
    valor character varying(300) NOT NULL
);


--
-- Name: TABLE info_adicional; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.info_adicional IS 'Campos adicionales a nivel de comprobante';


--
-- Name: motivos_nota_debito; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.motivos_nota_debito (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    comprobante_id uuid NOT NULL,
    razon text NOT NULL,
    valor numeric(18,2) NOT NULL
);


--
-- Name: TABLE motivos_nota_debito; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.motivos_nota_debito IS 'Motivos/razones de notas de débito';


--
-- Name: puntos_emision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puntos_emision (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    establecimiento_id uuid NOT NULL,
    codigo character varying(3) NOT NULL,
    descripcion character varying(100),
    estado character varying(20) DEFAULT 'ACTIVO'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE puntos_emision; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.puntos_emision IS 'Puntos de emisión por establecimiento';


--
-- Name: secuenciales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.secuenciales (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    punto_emision_id uuid NOT NULL,
    tipo_comprobante character varying(2) NOT NULL,
    ultimo_secuencial integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE secuenciales; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.secuenciales IS 'Control de secuenciales por punto de emisión y tipo de comprobante';


--
-- Name: sistema_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sistema_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clave character varying NOT NULL,
    valor text NOT NULL,
    descripcion text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nombre character varying(300) NOT NULL,
    plan character varying(50) DEFAULT 'BASICO'::character varying,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE tenants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenants IS 'Empresas/clientes del sistema SRI multi-tenant';


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    rol public.user_role DEFAULT 'USER'::public.user_role NOT NULL,
    tenant_id uuid,
    activo boolean DEFAULT true NOT NULL,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    emisor_id uuid,
    nombre character varying(100) NOT NULL,
    url text NOT NULL,
    eventos text[] DEFAULT '{}'::text[] NOT NULL,
    secreto character varying(100) NOT NULL,
    activo boolean DEFAULT true,
    reintentos_max integer DEFAULT 3,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE webhook_configs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.webhook_configs IS 'Configuración de webhooks para notificaciones de eventos';


--
-- Name: webhook_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_id uuid,
    evento character varying(50) NOT NULL,
    payload jsonb NOT NULL,
    status_code integer,
    respuesta text,
    intento integer DEFAULT 1,
    exitoso boolean DEFAULT false,
    error text,
    tiempo_respuesta_ms integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE webhook_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.webhook_logs IS 'Logs de ejecución de webhooks';


--
-- Data for Name: auditoria; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: catalogo_documentos_sustento; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.catalogo_documentos_sustento VALUES ('98e622e0-0e65-43fc-9c4d-8d2cad5e5354', '01', 'FACTURA', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('e71bee45-4796-4379-b2ff-7963a517f7f7', '02', 'NOTA O BOLETA DE VENTA', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('61dfe0f0-6bd1-4753-adce-71f676f57e23', '03', 'LIQUIDACIÓN DE COMPRA DE BIENES O PRESTACIÓN DE SERVICIOS', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('514e21cd-63cd-46b2-b935-e6dca4977fa1', '04', 'NOTA DE CRÉDITO', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('59f8e959-d54b-4831-b7ae-e5fc92b615e9', '05', 'NOTA DE DÉBITO', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('30b93c68-150d-4a7d-81e9-826ca644c905', '06', 'GUÍA DE REMISIÓN', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('3bcd6a01-27e7-4e4a-9dd1-8260f5af80f6', '07', 'COMPROBANTE DE RETENCIÓN', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('6ceb1f88-3119-4ee9-be4f-96724695aec2', '08', 'BOLETOS O ENTRADAS A ESPECTÁCULOS PÚBLICOS', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('84f00033-0f90-4b89-9806-07eaf5040f9d', '09', 'TIQUETES O VALES EMITIDOS POR MÁQUINAS REGISTRADORAS', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('be1142c8-3458-432d-8047-d9886cf3243e', '11', 'PASAJES EXPEDIDOS POR EMPRESAS DE AVIACIÓN', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('5683762d-52df-405e-b84a-7ed098613ca1', '12', 'DOCUMENTOS EMITIDOS POR INSTITUCIONES FINANCIERAS', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('f4401850-b070-4fb0-9170-6ffa672fd8cb', '15', 'COMPROBANTE DE VENTA EMITIDO EN EL EXTERIOR', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('167946a2-37c8-4afb-ba4f-df54f798f946', '18', 'DOCUMENTOS AUTORIZADOS UTILIZADOS EN VENTAS EXCEPTO N/C N/D', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('82384304-734e-49db-9bec-9dcce145d43f', '19', 'COMPROBANTES DE PAGO DE CUOTAS O APORTES', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('bb6b2bbd-1fbf-4a33-aab0-afe89bc57b62', '20', 'DOCUMENTOS POR SERVICIOS ADMINISTRADORAS DE TARJETA DE CRÉDITO', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('2b77b372-cc91-4eec-8a52-45278b98800e', '21', 'CARTA DE PORTE AÉREO', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('e686bcee-8f73-4717-a52f-93a250f68673', '41', 'COMPROBANTE DE VENTA EMITIDO POR REEMBOLSO', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('c1498752-c8fe-4377-8152-82ac18d7b6b7', '42', 'DOCUMENTO RETENCIÓN PRESUNTIVA Y RETENCIÓN EMITIDA POR PROPIO VENDEDOR', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('dd8bee9a-ce2e-4f8e-b901-dd20325f6610', '43', 'LIQUIDACIÓN PARA EXPLOTACIÓN Y EXPLORACIÓN DE HIDROCARBUROS', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('7a34e61d-ad5b-4e4a-9058-912f1b3f8004', '44', 'COMPROBANTE DE CONTRIBUCIONES Y APORTES', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('595cf3fc-1192-4b70-af81-749d1959e484', '45', 'LIQUIDACIÓN POR RECLAMOS DE ASEGURADORAS', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('51a7905b-b084-49fe-9b78-725da2fd401a', '47', 'NOTA DE CRÉDITO POR REEMBOLSO EMITIDA POR INTERMEDIARIO', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_documentos_sustento VALUES ('19ce129a-d583-446e-98ca-4eb82a792b80', '48', 'NOTA DE DÉBITO POR REEMBOLSO EMITIDA POR INTERMEDIARIO', true, '2026-01-23 21:06:01.473951+00');


--
-- Data for Name: catalogo_formas_pago; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.catalogo_formas_pago VALUES ('cbe13b24-7695-4cae-add9-91daddfeee16', '01', 'SIN UTILIZACION DEL SISTEMA FINANCIERO', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_formas_pago VALUES ('20956a88-fa15-43e1-b29a-56a35764cc02', '15', 'COMPENSACIÓN DE DEUDAS', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_formas_pago VALUES ('9ae1ecae-14ea-4ce7-9969-3d31f59a7e86', '16', 'TARJETA DE DÉBITO', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_formas_pago VALUES ('0dce36f7-3b1c-4932-865d-5ef56f6dd96d', '17', 'DINERO ELECTRÓNICO', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_formas_pago VALUES ('5ef15eab-be87-44f1-b06c-171fe73738fe', '18', 'TARJETA PREPAGO', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_formas_pago VALUES ('5b1274eb-2702-41e0-bcc8-58e91e090e9c', '19', 'TARJETA DE CRÉDITO', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_formas_pago VALUES ('8204dbbf-d031-4314-bee8-64f2875c1773', '20', 'OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_formas_pago VALUES ('d330349e-af17-4fef-983f-14c9abd52aea', '21', 'ENDOSO DE TÍTULOS', true, '2026-01-23 21:06:01.473951+00');


--
-- Data for Name: catalogo_impuestos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.catalogo_impuestos VALUES ('a228e0d0-55e1-4b9d-8867-c2c82ea585ee', '2', 'IVA', 'Impuesto al Valor Agregado', true, '2026-01-23 20:47:05.534545+00', '2026-01-23 20:47:05.534545+00');
INSERT INTO public.catalogo_impuestos VALUES ('738725d4-9f49-45a5-bb9b-d31a9d2a6b5c', '3', 'ICE', 'Impuesto a los Consumos Especiales', true, '2026-01-23 20:47:05.534545+00', '2026-01-23 20:47:05.534545+00');
INSERT INTO public.catalogo_impuestos VALUES ('700f88e1-0bd3-4c55-8dda-4f62a0137f5f', '5', 'IRBPNR', 'Impuesto Redimible Botellas Plásticas No Retornables', true, '2026-01-23 20:47:05.534545+00', '2026-01-23 20:47:05.534545+00');


--
-- Data for Name: catalogo_motivos_traslado; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.catalogo_motivos_traslado VALUES ('6026cac9-2b5b-4b74-b834-d23e6df6ff1c', '01', 'VENTA', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_motivos_traslado VALUES ('2431c661-6e53-489c-862e-4271eae59b59', '02', 'COMPRA', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_motivos_traslado VALUES ('5f4d4fcc-1031-4c1c-82cb-69e69e7eb6dc', '03', 'TRANSFORMACIÓN', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_motivos_traslado VALUES ('72f3b26a-7131-4a86-97ad-f524e850f8b4', '04', 'CONSIGNACIÓN', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_motivos_traslado VALUES ('2086b77a-8a55-4406-bc9e-e75817d2ac32', '05', 'DEVOLUCIÓN', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_motivos_traslado VALUES ('0bd47e88-f9ae-4e6d-af5b-790af86813ad', '06', 'TRASLADO ENTRE ESTABLECIMIENTOS DE UNA MISMA EMPRESA', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_motivos_traslado VALUES ('f64b19b2-685e-42f8-84d7-d9abb3cc594e', '07', 'TRASLADO POR EMISOR ITINERANTE', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_motivos_traslado VALUES ('cdb4116b-8f0f-4dc5-8126-f5268a7d9fe4', '08', 'EXPORTACIÓN', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_motivos_traslado VALUES ('080c02be-2b88-4b53-9839-1e9e867e431b', '09', 'OTROS', true, '2026-01-23 21:06:01.473951+00');


--
-- Data for Name: catalogo_retenciones; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.catalogo_retenciones VALUES ('f4792a56-6c80-4027-bac0-fa61e06c20e5', 'RENTA', '303', 'Honorarios profesionales y dietas', 10.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('7d93fcec-ce69-47a9-954a-ec03af9a0d4b', 'RENTA', '304', 'Servicios predomina mano de obra', 2.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('a7ee8c2d-e4ba-46ab-8460-d61e1a1d5edb', 'RENTA', '307', 'Servicios predomina intelecto', 2.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('c53a91ff-50f3-44c7-931e-5f3b531dc0c6', 'RENTA', '308', 'Servicios publicidad y comunicación', 1.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('06ff076e-4106-469a-b827-e36d7558f774', 'RENTA', '309', 'Transporte privado de pasajeros o servicio público o privado de carga', 1.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('53bd6cc7-5c19-4a16-b3c6-676933ef4ca6', 'RENTA', '310', 'Transferencia de bienes muebles de naturaleza corporal', 1.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('6275eff7-8cd4-43f8-b9c4-a017f646e75e', 'RENTA', '312', 'Transferencia de bienes inmuebles', 1.75, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('ad658d83-8df8-44dd-8e69-e8b1f773c2da', 'RENTA', '319', 'Arrendamiento mercantil', 1.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('1f75b985-26fb-4fb6-903e-9f181e33b478', 'RENTA', '320', 'Arrendamiento bienes inmuebles', 8.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('508632fc-ea08-43a3-ab21-2435ee44e09a', 'RENTA', '322', 'Seguros y reaseguros (primas y cesiones)', 1.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('a33a191a-d27f-4feb-8b12-23ee22e5a6c2', 'RENTA', '323', 'Rendimientos financieros', 2.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('119b9d5a-71e5-449d-920e-46d9fd017b44', 'RENTA', '332', 'Otras compras bienes y servicios no sujetas', 0.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('ed01cb1d-4114-43ca-9da3-8a0f8688faca', 'RENTA', '340', 'Aplicables el 1%', 1.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('22184055-a85e-4c1d-adc3-f331fba4d92a', 'RENTA', '341', 'Aplicables el 2%', 2.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('5fe7fbea-753f-44b8-b799-7ea1570cc0d7', 'RENTA', '342', 'Aplicables el 8%', 8.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('3bf366f8-89c0-4a0b-a810-16ec21a3df58', 'RENTA', '343', 'Aplicables el 25%', 25.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('2fca3472-8214-47f1-839c-5a634ac71399', 'RENTA', '344', 'Aplicables a otros porcentajes', 0.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('fae39916-1247-478f-860e-9b3d2093bd8a', 'IVA', '721', 'Retención 30% IVA Bienes', 30.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('9916ccd9-23f6-42c4-a60f-8218fb59400c', 'IVA', '723', 'Retención 70% IVA Servicios', 70.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('5922a34b-248e-46b1-8899-4374c0bc2aed', 'IVA', '725', 'Retención 100% IVA', 100.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('6014bfcc-7e55-4f6f-addd-f231f14b4461', 'IVA', '727', 'Retención 10% IVA Bienes', 10.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('68479eb1-1642-4a49-a096-860323adf065', 'IVA', '729', 'Retención 20% IVA Servicios', 20.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('933d3dda-c08c-4787-8cb7-6647dfb89e64', 'IVA', '731', 'Retención 50% IVA Derivados Petróleo', 50.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');
INSERT INTO public.catalogo_retenciones VALUES ('51e4096f-4348-4927-b6d9-40f4923c148e', 'ISD', '4580', 'Retención ISD', 5.00, '2024-01-01', NULL, true, '2026-01-23 20:47:28.199209+00', '2026-01-23 20:47:28.199209+00');


--
-- Data for Name: catalogo_tarifas_impuesto; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.catalogo_tarifas_impuesto VALUES ('97697df3-ae38-404f-bfcb-e0cc6ebd3395', 'a228e0d0-55e1-4b9d-8867-c2c82ea585ee', '0', 'IVA 0%', 0.00, '2024-01-01', NULL, true, '2026-01-23 20:47:05.534545+00', '2026-01-23 20:47:05.534545+00');
INSERT INTO public.catalogo_tarifas_impuesto VALUES ('cd729f39-8487-4fae-b03d-938ada2b3a3e', 'a228e0d0-55e1-4b9d-8867-c2c82ea585ee', '2', 'IVA 12%', 12.00, '2024-01-01', NULL, true, '2026-01-23 20:47:05.534545+00', '2026-01-23 20:47:05.534545+00');
INSERT INTO public.catalogo_tarifas_impuesto VALUES ('406dd54e-0779-4e5a-a64d-d74f78ce1af6', 'a228e0d0-55e1-4b9d-8867-c2c82ea585ee', '3', 'IVA 14%', 14.00, '2024-01-01', NULL, true, '2026-01-23 20:47:05.534545+00', '2026-01-23 20:47:05.534545+00');
INSERT INTO public.catalogo_tarifas_impuesto VALUES ('506198a2-6313-4e70-a039-b254d1c23bfc', 'a228e0d0-55e1-4b9d-8867-c2c82ea585ee', '4', 'IVA 15%', 15.00, '2024-04-01', NULL, true, '2026-01-23 20:47:05.534545+00', '2026-01-23 20:47:05.534545+00');
INSERT INTO public.catalogo_tarifas_impuesto VALUES ('6dc5e950-2ad3-4033-afeb-2433803ce440', 'a228e0d0-55e1-4b9d-8867-c2c82ea585ee', '5', 'IVA 5%', 5.00, '2024-01-01', NULL, true, '2026-01-23 20:47:05.534545+00', '2026-01-23 20:47:05.534545+00');
INSERT INTO public.catalogo_tarifas_impuesto VALUES ('5f3733e8-3abe-4742-98d8-d0669c8464b2', 'a228e0d0-55e1-4b9d-8867-c2c82ea585ee', '6', 'No Objeto de Impuesto', 0.00, '2024-01-01', NULL, true, '2026-01-23 20:47:05.534545+00', '2026-01-23 20:47:05.534545+00');
INSERT INTO public.catalogo_tarifas_impuesto VALUES ('6417d0ea-116a-4e27-8163-7a2e6e4c35a0', 'a228e0d0-55e1-4b9d-8867-c2c82ea585ee', '7', 'Exento de IVA', 0.00, '2024-01-01', NULL, true, '2026-01-23 20:47:05.534545+00', '2026-01-23 20:47:05.534545+00');
INSERT INTO public.catalogo_tarifas_impuesto VALUES ('71a37ebe-f71d-4167-aaf8-2117619f5fa7', 'a228e0d0-55e1-4b9d-8867-c2c82ea585ee', '8', 'IVA Diferenciado', 0.00, '2024-01-01', NULL, true, '2026-01-23 20:47:05.534545+00', '2026-01-23 20:47:05.534545+00');


--
-- Data for Name: catalogo_tipos_identificacion; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.catalogo_tipos_identificacion VALUES ('b3a69c29-221e-4497-9b96-525adcb95c31', '04', 'RUC', 13, '^\d{13}$', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_tipos_identificacion VALUES ('69fd9ff1-062e-4ff2-af5e-820b8d9afcd7', '05', 'CÉDULA', 10, '^\d{10}$', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_tipos_identificacion VALUES ('7fed96a2-8d01-4c62-9893-54de6f411d5b', '06', 'PASAPORTE', NULL, '^[A-Za-z0-9]+$', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_tipos_identificacion VALUES ('3662ea2a-4fd5-46c3-b21d-65766dd6be67', '07', 'CONSUMIDOR FINAL', 13, '^9{13}$', true, '2026-01-23 21:06:01.473951+00');
INSERT INTO public.catalogo_tipos_identificacion VALUES ('6d00648a-6768-443b-a904-e702a2cdb390', '08', 'IDENTIFICACIÓN DEL EXTERIOR', NULL, '^[A-Za-z0-9]+$', true, '2026-01-23 21:06:01.473951+00');


--
-- Data for Name: comprobante_detalles; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: comprobante_impuestos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: comprobante_pagos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: comprobante_retenciones; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: comprobante_totales; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: comprobante_xmls; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: comprobantes; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: detalles_adicionales; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: emisores; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: establecimientos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: guia_destinatarios; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: guia_detalles; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: info_adicional; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: motivos_nota_debito; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: puntos_emision; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: secuenciales; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: sistema_config; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.sistema_config VALUES ('545b20d5-48c8-4b78-bce1-77d125da0a01', 'SRI_SYNC_MAX_LIMIT', '500', 'Límite máximo de comprobantes a sincronizar por lote', '2026-04-26 18:44:54.01142+00', '2026-04-26 18:44:54.01142+00');
INSERT INTO public.sistema_config VALUES ('2a144540-4ce1-444e-b7ee-54c0a1463a52', 'SRI_MAX_RETRIES', '3', 'Número máximo de reintentos para consultas al SRI', '2026-04-26 18:44:54.01142+00', '2026-04-26 18:44:54.01142+00');
INSERT INTO public.sistema_config VALUES ('9be629a1-19ae-443d-9573-d359328e9143', 'SRI_RETRY_DELAY_MS', '2000', 'Retraso entre reintentos en milisegundos', '2026-04-26 18:44:54.01142+00', '2026-04-26 18:44:54.01142+00');
INSERT INTO public.sistema_config VALUES ('f05b10fa-8574-431c-b9bf-84f4d60be68f', 'CACHE_EMISOR_TTL_MS', '3600000', 'TTL de la caché de emisores (1 hora)', '2026-04-26 18:44:54.01142+00', '2026-04-26 18:44:54.01142+00');
INSERT INTO public.sistema_config VALUES ('746120e5-7130-4cdc-9bef-890f6c8db63a', 'CACHE_CERT_TTL_MS', '3600000', 'TTL de la caché de certificados (1 hora)', '2026-04-26 18:44:54.01142+00', '2026-04-26 18:44:54.01142+00');


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.usuarios (id, email, password_hash, rol, tenant_id, activo, created_at, updated_at, last_login) VALUES ('00000000-0000-0000-0000-000000000000', 'superadmin@openapi-sri.com', '$2b$12$85teQgrnCqABaMn.DH0b3O8.M3Zk5RhUuZe3J/rqsgBlDqCSVFRKm', 'SUPERADMIN', NULL, true, now(), now(), NULL) ON CONFLICT DO NOTHING;


--
-- Data for Name: webhook_configs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: webhook_logs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: catalogo_documentos_sustento catalogo_documentos_sustento_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_documentos_sustento
    ADD CONSTRAINT catalogo_documentos_sustento_codigo_key UNIQUE (codigo);


--
-- Name: catalogo_documentos_sustento catalogo_documentos_sustento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_documentos_sustento
    ADD CONSTRAINT catalogo_documentos_sustento_pkey PRIMARY KEY (id);


--
-- Name: catalogo_formas_pago catalogo_formas_pago_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_formas_pago
    ADD CONSTRAINT catalogo_formas_pago_codigo_key UNIQUE (codigo);


--
-- Name: catalogo_formas_pago catalogo_formas_pago_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_formas_pago
    ADD CONSTRAINT catalogo_formas_pago_pkey PRIMARY KEY (id);


--
-- Name: catalogo_impuestos catalogo_impuestos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_impuestos
    ADD CONSTRAINT catalogo_impuestos_codigo_key UNIQUE (codigo);


--
-- Name: catalogo_impuestos catalogo_impuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_impuestos
    ADD CONSTRAINT catalogo_impuestos_pkey PRIMARY KEY (id);


--
-- Name: catalogo_motivos_traslado catalogo_motivos_traslado_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_motivos_traslado
    ADD CONSTRAINT catalogo_motivos_traslado_codigo_key UNIQUE (codigo);


--
-- Name: catalogo_motivos_traslado catalogo_motivos_traslado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_motivos_traslado
    ADD CONSTRAINT catalogo_motivos_traslado_pkey PRIMARY KEY (id);


--
-- Name: catalogo_retenciones catalogo_retenciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_retenciones
    ADD CONSTRAINT catalogo_retenciones_pkey PRIMARY KEY (id);


--
-- Name: catalogo_retenciones catalogo_retenciones_tipo_codigo_vigente_desde_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_retenciones
    ADD CONSTRAINT catalogo_retenciones_tipo_codigo_vigente_desde_key UNIQUE (tipo, codigo, vigente_desde);


--
-- Name: catalogo_tarifas_impuesto catalogo_tarifas_impuesto_impuesto_id_codigo_porcentaje_vig_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_tarifas_impuesto
    ADD CONSTRAINT catalogo_tarifas_impuesto_impuesto_id_codigo_porcentaje_vig_key UNIQUE (impuesto_id, codigo_porcentaje, vigente_desde);


--
-- Name: catalogo_tarifas_impuesto catalogo_tarifas_impuesto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_tarifas_impuesto
    ADD CONSTRAINT catalogo_tarifas_impuesto_pkey PRIMARY KEY (id);


--
-- Name: catalogo_tipos_identificacion catalogo_tipos_identificacion_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_tipos_identificacion
    ADD CONSTRAINT catalogo_tipos_identificacion_codigo_key UNIQUE (codigo);


--
-- Name: catalogo_tipos_identificacion catalogo_tipos_identificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_tipos_identificacion
    ADD CONSTRAINT catalogo_tipos_identificacion_pkey PRIMARY KEY (id);


--
-- Name: comprobante_detalles comprobante_detalles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante_detalles
    ADD CONSTRAINT comprobante_detalles_pkey PRIMARY KEY (id);


--
-- Name: comprobante_impuestos comprobante_impuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante_impuestos
    ADD CONSTRAINT comprobante_impuestos_pkey PRIMARY KEY (id);


--
-- Name: comprobante_pagos comprobante_pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante_pagos
    ADD CONSTRAINT comprobante_pagos_pkey PRIMARY KEY (id);


--
-- Name: comprobante_retenciones comprobante_retenciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante_retenciones
    ADD CONSTRAINT comprobante_retenciones_pkey PRIMARY KEY (id);


--
-- Name: comprobante_totales comprobante_totales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante_totales
    ADD CONSTRAINT comprobante_totales_pkey PRIMARY KEY (id);


--
-- Name: comprobante_xmls comprobante_xmls_comprobante_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante_xmls
    ADD CONSTRAINT comprobante_xmls_comprobante_id_key UNIQUE (comprobante_id);


--
-- Name: comprobante_xmls comprobante_xmls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante_xmls
    ADD CONSTRAINT comprobante_xmls_pkey PRIMARY KEY (id);


--
-- Name: comprobantes comprobantes_clave_acceso_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobantes
    ADD CONSTRAINT comprobantes_clave_acceso_key UNIQUE (clave_acceso);


--
-- Name: comprobantes comprobantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobantes
    ADD CONSTRAINT comprobantes_pkey PRIMARY KEY (id);


--
-- Name: detalles_adicionales detalles_adicionales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalles_adicionales
    ADD CONSTRAINT detalles_adicionales_pkey PRIMARY KEY (id);


--
-- Name: emisores emisores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emisores
    ADD CONSTRAINT emisores_pkey PRIMARY KEY (id);


--
-- Name: emisores emisores_tenant_id_ruc_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emisores
    ADD CONSTRAINT emisores_tenant_id_ruc_key UNIQUE (tenant_id, ruc);


--
-- Name: establecimientos establecimientos_emisor_id_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.establecimientos
    ADD CONSTRAINT establecimientos_emisor_id_codigo_key UNIQUE (emisor_id, codigo);


--
-- Name: establecimientos establecimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.establecimientos
    ADD CONSTRAINT establecimientos_pkey PRIMARY KEY (id);


--
-- Name: guia_destinatarios guia_destinatarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guia_destinatarios
    ADD CONSTRAINT guia_destinatarios_pkey PRIMARY KEY (id);


--
-- Name: guia_detalles guia_detalles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guia_detalles
    ADD CONSTRAINT guia_detalles_pkey PRIMARY KEY (id);


--
-- Name: info_adicional info_adicional_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.info_adicional
    ADD CONSTRAINT info_adicional_pkey PRIMARY KEY (id);


--
-- Name: motivos_nota_debito motivos_nota_debito_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motivos_nota_debito
    ADD CONSTRAINT motivos_nota_debito_pkey PRIMARY KEY (id);


--
-- Name: puntos_emision puntos_emision_establecimiento_id_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puntos_emision
    ADD CONSTRAINT puntos_emision_establecimiento_id_codigo_key UNIQUE (establecimiento_id, codigo);


--
-- Name: puntos_emision puntos_emision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puntos_emision
    ADD CONSTRAINT puntos_emision_pkey PRIMARY KEY (id);


--
-- Name: secuenciales secuenciales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secuenciales
    ADD CONSTRAINT secuenciales_pkey PRIMARY KEY (id);


--
-- Name: secuenciales secuenciales_punto_emision_id_tipo_comprobante_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secuenciales
    ADD CONSTRAINT secuenciales_punto_emision_id_tipo_comprobante_key UNIQUE (punto_emision_id, tipo_comprobante);


--
-- Name: sistema_config sistema_config_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistema_config
    ADD CONSTRAINT sistema_config_clave_key UNIQUE (clave);


--
-- Name: sistema_config sistema_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistema_config
    ADD CONSTRAINT sistema_config_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: webhook_configs webhook_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_configs
    ADD CONSTRAINT webhook_configs_pkey PRIMARY KEY (id);


--
-- Name: webhook_logs webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: idx_auditoria_accion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_accion ON public.auditoria USING btree (accion);


--
-- Name: idx_auditoria_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_created_at ON public.auditoria USING btree (created_at DESC);


--
-- Name: idx_auditoria_fecha_accion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_fecha_accion ON public.auditoria USING btree (created_at DESC, accion);


--
-- Name: idx_auditoria_recurso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_recurso ON public.auditoria USING btree (recurso, recurso_id);


--
-- Name: idx_auditoria_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_tenant ON public.auditoria USING btree (tenant_id);


--
-- Name: idx_auditoria_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_usuario ON public.auditoria USING btree (usuario_id);


--
-- Name: idx_catalogo_impuestos_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalogo_impuestos_codigo ON public.catalogo_impuestos USING btree (codigo);


--
-- Name: idx_catalogo_retenciones_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalogo_retenciones_activo ON public.catalogo_retenciones USING btree (activo) WHERE (activo = true);


--
-- Name: idx_catalogo_retenciones_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalogo_retenciones_codigo ON public.catalogo_retenciones USING btree (codigo);


--
-- Name: idx_catalogo_retenciones_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalogo_retenciones_tipo ON public.catalogo_retenciones USING btree (tipo);


--
-- Name: idx_catalogo_tarifas_vigencia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalogo_tarifas_vigencia ON public.catalogo_tarifas_impuesto USING btree (vigente_desde, vigente_hasta);


--
-- Name: idx_comprobantes_clave; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comprobantes_clave ON public.comprobantes USING btree (clave_acceso);


--
-- Name: idx_comprobantes_emisor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comprobantes_emisor ON public.comprobantes USING btree (emisor_id);


--
-- Name: idx_comprobantes_emisor_fecha_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comprobantes_emisor_fecha_desc ON public.comprobantes USING btree (emisor_id, fecha_emision DESC);


--
-- Name: idx_comprobantes_estado_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comprobantes_estado_activo ON public.comprobantes USING btree (estado_sri) WHERE ((estado_sri)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'EN_PROCESO'::character varying, 'DEVUELTA'::character varying, 'RECIBIDA'::character varying])::text[]));


--
-- Name: idx_comprobantes_receptor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comprobantes_receptor ON public.comprobantes USING btree (receptor_identificacion);


--
-- Name: idx_comprobantes_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comprobantes_tipo ON public.comprobantes USING btree (tipo_comprobante);


--
-- Name: idx_detalles_adicionales_detalle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_detalles_adicionales_detalle ON public.detalles_adicionales USING btree (comprobante_detalle_id);


--
-- Name: idx_detalles_comprobante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_detalles_comprobante ON public.comprobante_detalles USING btree (comprobante_id);


--
-- Name: idx_docs_sustento_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_sustento_activo ON public.catalogo_documentos_sustento USING btree (activo) WHERE (activo = true);


--
-- Name: idx_emisores_ruc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emisores_ruc ON public.emisores USING btree (ruc);


--
-- Name: idx_emisores_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emisores_tenant ON public.emisores USING btree (tenant_id);


--
-- Name: idx_establecimientos_emisor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_establecimientos_emisor ON public.establecimientos USING btree (emisor_id);


--
-- Name: idx_formas_pago_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formas_pago_activo ON public.catalogo_formas_pago USING btree (activo) WHERE (activo = true);


--
-- Name: idx_guia_destinatarios_comprobante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guia_destinatarios_comprobante ON public.guia_destinatarios USING btree (comprobante_id);


--
-- Name: idx_guia_detalles_destinatario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guia_detalles_destinatario ON public.guia_detalles USING btree (destinatario_id);


--
-- Name: idx_impuestos_detalle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_impuestos_detalle ON public.comprobante_impuestos USING btree (comprobante_detalle_id);


--
-- Name: idx_info_adicional_comprobante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_info_adicional_comprobante ON public.info_adicional USING btree (comprobante_id);


--
-- Name: idx_motivos_nd_comprobante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_motivos_nd_comprobante ON public.motivos_nota_debito USING btree (comprobante_id);


--
-- Name: idx_motivos_traslado_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_motivos_traslado_activo ON public.catalogo_motivos_traslado USING btree (activo) WHERE (activo = true);


--
-- Name: idx_pagos_comprobante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_comprobante ON public.comprobante_pagos USING btree (comprobante_id);


--
-- Name: idx_puntos_emision_establecimiento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_puntos_emision_establecimiento ON public.puntos_emision USING btree (establecimiento_id);


--
-- Name: idx_retenciones_comprobante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retenciones_comprobante ON public.comprobante_retenciones USING btree (comprobante_id);


--
-- Name: idx_secuenciales_punto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_secuenciales_punto ON public.secuenciales USING btree (punto_emision_id);


--
-- Name: idx_tipos_ident_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tipos_ident_activo ON public.catalogo_tipos_identificacion USING btree (activo) WHERE (activo = true);


--
-- Name: idx_totales_comprobante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_totales_comprobante ON public.comprobante_totales USING btree (comprobante_id);


--
-- Name: idx_usuarios_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_email ON public.usuarios USING btree (email);


--
-- Name: idx_usuarios_rol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_rol ON public.usuarios USING btree (rol);


--
-- Name: idx_usuarios_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_tenant_id ON public.usuarios USING btree (tenant_id);


--
-- Name: idx_webhook_configs_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_configs_activo ON public.webhook_configs USING btree (activo);


--
-- Name: idx_webhook_configs_emisor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_configs_emisor ON public.webhook_configs USING btree (emisor_id);


--
-- Name: idx_webhook_logs_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_logs_config ON public.webhook_logs USING btree (config_id);


--
-- Name: idx_webhook_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_logs_created ON public.webhook_logs USING btree (created_at DESC);


--
-- Name: idx_webhook_logs_evento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_logs_evento ON public.webhook_logs USING btree (evento);


--
-- Name: idx_xmls_comprobante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_xmls_comprobante ON public.comprobante_xmls USING btree (comprobante_id);


--
-- Name: auditoria auditoria_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: catalogo_tarifas_impuesto catalogo_tarifas_impuesto_impuesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_tarifas_impuesto
    ADD CONSTRAINT catalogo_tarifas_impuesto_impuesto_id_fkey FOREIGN KEY (impuesto_id) REFERENCES public.catalogo_impuestos(id) ON DELETE CASCADE;


--
-- Name: comprobante_detalles comprobante_detalles_comprobante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante_detalles
    ADD CONSTRAINT comprobante_detalles_comprobante_id_fkey FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes(id) ON DELETE CASCADE;


--
-- Name: comprobante_impuestos comprobante_impuestos_comprobante_detalle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante_impuestos
    ADD CONSTRAINT comprobante_impuestos_comprobante_detalle_id_fkey FOREIGN KEY (comprobante_detalle_id) REFERENCES public.comprobante_detalles(id) ON DELETE CASCADE;


--
-- Name: comprobante_pagos comprobante_pagos_comprobante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante_pagos
    ADD CONSTRAINT comprobante_pagos_comprobante_id_fkey FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes(id) ON DELETE CASCADE;


--
-- Name: comprobante_retenciones comprobante_retenciones_comprobante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante_retenciones
    ADD CONSTRAINT comprobante_retenciones_comprobante_id_fkey FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes(id) ON DELETE CASCADE;


--
-- Name: comprobante_totales comprobante_totales_comprobante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante_totales
    ADD CONSTRAINT comprobante_totales_comprobante_id_fkey FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes(id) ON DELETE CASCADE;


--
-- Name: comprobante_xmls comprobante_xmls_comprobante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobante_xmls
    ADD CONSTRAINT comprobante_xmls_comprobante_id_fkey FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes(id) ON DELETE CASCADE;


--
-- Name: comprobantes comprobantes_emisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobantes
    ADD CONSTRAINT comprobantes_emisor_id_fkey FOREIGN KEY (emisor_id) REFERENCES public.emisores(id) ON DELETE CASCADE;


--
-- Name: comprobantes comprobantes_punto_emision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobantes
    ADD CONSTRAINT comprobantes_punto_emision_id_fkey FOREIGN KEY (punto_emision_id) REFERENCES public.puntos_emision(id);


--
-- Name: detalles_adicionales detalles_adicionales_comprobante_detalle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalles_adicionales
    ADD CONSTRAINT detalles_adicionales_comprobante_detalle_id_fkey FOREIGN KEY (comprobante_detalle_id) REFERENCES public.comprobante_detalles(id) ON DELETE CASCADE;


--
-- Name: emisores emisores_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emisores
    ADD CONSTRAINT emisores_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: establecimientos establecimientos_emisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.establecimientos
    ADD CONSTRAINT establecimientos_emisor_id_fkey FOREIGN KEY (emisor_id) REFERENCES public.emisores(id) ON DELETE CASCADE;


--
-- Name: guia_destinatarios guia_destinatarios_comprobante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guia_destinatarios
    ADD CONSTRAINT guia_destinatarios_comprobante_id_fkey FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes(id) ON DELETE CASCADE;


--
-- Name: guia_detalles guia_detalles_destinatario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guia_detalles
    ADD CONSTRAINT guia_detalles_destinatario_id_fkey FOREIGN KEY (destinatario_id) REFERENCES public.guia_destinatarios(id) ON DELETE CASCADE;


--
-- Name: info_adicional info_adicional_comprobante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.info_adicional
    ADD CONSTRAINT info_adicional_comprobante_id_fkey FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes(id) ON DELETE CASCADE;


--
-- Name: motivos_nota_debito motivos_nota_debito_comprobante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motivos_nota_debito
    ADD CONSTRAINT motivos_nota_debito_comprobante_id_fkey FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes(id) ON DELETE CASCADE;


--
-- Name: puntos_emision puntos_emision_establecimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puntos_emision
    ADD CONSTRAINT puntos_emision_establecimiento_id_fkey FOREIGN KEY (establecimiento_id) REFERENCES public.establecimientos(id) ON DELETE CASCADE;


--
-- Name: secuenciales secuenciales_punto_emision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secuenciales
    ADD CONSTRAINT secuenciales_punto_emision_id_fkey FOREIGN KEY (punto_emision_id) REFERENCES public.puntos_emision(id) ON DELETE CASCADE;


--
-- Name: usuarios usuarios_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- Name: webhook_configs webhook_configs_emisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_configs
    ADD CONSTRAINT webhook_configs_emisor_id_fkey FOREIGN KEY (emisor_id) REFERENCES public.emisores(id) ON DELETE CASCADE;


--
-- Name: webhook_configs webhook_configs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_configs
    ADD CONSTRAINT webhook_configs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: webhook_logs webhook_logs_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.webhook_configs(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


