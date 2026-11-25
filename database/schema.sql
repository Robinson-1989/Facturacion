-- Esquema Relacional PostgreSQL - Sistema Integral de Gestión Farmacéutica Multi-Sucursal
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE sucursales (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(20) UNIQUE NOT NULL,
    nombre          VARCHAR(100) NOT NULL,
    rnc_fiscal      VARCHAR(30) NOT NULL,
    direccion       TEXT NOT NULL,
    telefono        VARCHAR(25),
    activa          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    sucursal_id     INT REFERENCES sucursales(id) ON DELETE RESTRICT,
    nombre_completo VARCHAR(120) NOT NULL,
    email           VARCHAR(120) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    rol             VARCHAR(20) NOT NULL CHECK (rol IN ('SUPERADMIN', 'ENCARGADO', 'CAJERO')),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_usuario_sucursal_rol CHECK (
        (rol = 'SUPERADMIN' AND sucursal_id IS NULL) OR
        (rol IN ('ENCARGADO', 'CAJERO') AND sucursal_id IS NOT NULL)
    )
);

CREATE TABLE productos (
    id                  SERIAL PRIMARY KEY,
    codigo_barras       VARCHAR(50) UNIQUE NOT NULL,
    nombre_comercial    VARCHAR(150) NOT NULL,
    principio_activo    VARCHAR(150) NOT NULL,
    laboratorio         VARCHAR(100) NOT NULL,
    presentacion        VARCHAR(100) NOT NULL,
    precio_costo        NUMERIC(12, 2) NOT NULL CHECK (precio_costo >= 0),
    precio_venta        NUMERIC(12, 2) NOT NULL CHECK (precio_venta >= 0),
    impuesto_pct        NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    requiere_receta     BOOLEAN NOT NULL DEFAULT FALSE,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_productos_nombre_trgm ON productos USING GIN (nombre_comercial gin_trgm_ops);
CREATE INDEX idx_productos_principio_trgm ON productos USING GIN (principio_activo gin_trgm_ops);

CREATE TABLE inventario_sucursal (
    id                  SERIAL PRIMARY KEY,
    sucursal_id         INT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    producto_id         INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    stock_actual        INT NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo        INT NOT NULL DEFAULT 10,
    ubicacion_pasillo   VARCHAR(50) NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sucursal_id, producto_id)
);

CREATE TABLE lotes (
    id                  SERIAL PRIMARY KEY,
    sucursal_id         INT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    producto_id         INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    numero_lote         VARCHAR(60) NOT NULL,
    fecha_vencimiento   DATE NOT NULL,
    cantidad_inicial    INT NOT NULL CHECK (cantidad_inicial > 0),
    cantidad_disponible INT NOT NULL CHECK (cantidad_disponible >= 0),
    costo_unitario      NUMERIC(12, 2) NOT NULL,
    fecha_ingreso       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sucursal_id, producto_id, numero_lote)
);

CREATE INDEX idx_lotes_fefo
    ON lotes (sucursal_id, producto_id, fecha_vencimiento ASC)
    WHERE cantidad_disponible > 0;

CREATE TABLE traslados (
    id                  SERIAL PRIMARY KEY,
    sucursal_origen_id  INT NOT NULL REFERENCES sucursales(id),
    sucursal_destino_id INT NOT NULL REFERENCES sucursales(id),
    producto_id         INT NOT NULL REFERENCES productos(id),
    lote_id             INT REFERENCES lotes(id),
    cantidad            INT NOT NULL CHECK (cantidad > 0),
    estado              VARCHAR(20) NOT NULL DEFAULT 'SOLICITADO'
                        CHECK (estado IN ('SOLICITADO', 'EN_TRANSITO', 'COMPLETADO', 'RECHAZADO')),
    solicitado_por      INT NOT NULL REFERENCES usuarios(id),
    aprobado_por        INT REFERENCES usuarios(id),
    notas               TEXT,
    fecha_solicitud     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_recepcion     TIMESTAMPTZ,
    CONSTRAINT chk_sucursales_distintas CHECK (sucursal_origen_id <> sucursal_destino_id)
);

CREATE TABLE ventas (
    id                  BIGSERIAL PRIMARY KEY,
    numero_factura      VARCHAR(40) UNIQUE NOT NULL,
    sucursal_id         INT NOT NULL REFERENCES sucursales(id),
    usuario_id          INT NOT NULL REFERENCES usuarios(id),
    subtotal            NUMERIC(12, 2) NOT NULL,
    descuento_total     NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    impuesto_total      NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_venta         NUMERIC(12, 2) NOT NULL,
    costo_total_cogs    NUMERIC(12, 2) NOT NULL,
    metodo_pago         VARCHAR(25) NOT NULL
                        CHECK (metodo_pago IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'SEGURO_MEDICO')),
    estado              VARCHAR(20) NOT NULL DEFAULT 'COMPLETADA'
                        CHECK (estado IN ('COMPLETADA', 'ANULADA')),
    fecha_venta         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ventas_sucursal_fecha ON ventas (sucursal_id, fecha_venta DESC) WHERE estado = 'COMPLETADA';

CREATE TABLE detalle_ventas (
    id                  BIGSERIAL PRIMARY KEY,
    venta_id            BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id         INT NOT NULL REFERENCES productos(id),
    lote_id             INT NOT NULL REFERENCES lotes(id),
    cantidad            INT NOT NULL CHECK (cantidad > 0),
    precio_unitario     NUMERIC(12, 2) NOT NULL,
    costo_unitario      NUMERIC(12, 2) NOT NULL,
    descuento           NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    impuesto            NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal_linea      NUMERIC(12, 2) NOT NULL
);

CREATE INDEX idx_detalle_ventas_producto ON detalle_ventas (producto_id);

CREATE TABLE empleados (
    id                  SERIAL PRIMARY KEY,
    sucursal_id         INT NOT NULL REFERENCES sucursales(id),
    usuario_id          INT UNIQUE REFERENCES usuarios(id),
    documento_identidad VARCHAR(30) UNIQUE NOT NULL,
    nombre_completo     VARCHAR(120) NOT NULL,
    cargo               VARCHAR(60) NOT NULL,
    salario_base        NUMERIC(12, 2) NOT NULL CHECK (salario_base >= 0),
    porcentaje_comision NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    fecha_ingreso       DATE NOT NULL,
    activo              BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE nomina (
    id                  SERIAL PRIMARY KEY,
    sucursal_id         INT NOT NULL REFERENCES sucursales(id),
    empleado_id         INT NOT NULL REFERENCES empleados(id),
    periodo_tipo        VARCHAR(15) NOT NULL CHECK (periodo_tipo IN ('QUINCENAL', 'MENSUAL')),
    fecha_inicio        DATE NOT NULL,
    fecha_fin           DATE NOT NULL,
    fecha_pago          DATE,
    salario_bruto       NUMERIC(12, 2) NOT NULL,
    comisiones          NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    bonificaciones      NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    deducciones_ley     NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    neto_pagar          NUMERIC(12, 2) NOT NULL,
    estado              VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PAGADA'))
);

CREATE INDEX idx_nomina_sucursal_pago ON nomina (sucursal_id, fecha_pago) WHERE estado = 'PAGADA';
