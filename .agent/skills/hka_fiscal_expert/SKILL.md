---
name: hka_fiscal_expert
description: Repositorio maestro de conocimiento para el protocolo fiscal HKA/Z1F en Odoo.sh. Centraliza logros, evita regresiones y asegura la trazabilidad del Checksum (LRC) y estructura de tramas.
---

# HKA Fiscal Expert (Source of Truth)

Este skill preserva el conocimiento crítico adquirido durante la estabilización del driver fiscal HKA para Odoo 18. **Úsese como referencia obligatoria antes de cualquier cambio en el driver.**

## Protocolo HKA-NG (New Generation)

### 1. Estructura de Trama (Padding)
Las impresoras HKA modernas (etiquetadas como NG o con firmwares recientes) requieren campos de datos fijos y extendidos.
- **Total Data**: 33 dígitos exactos antes de cualquier partición (`|`).
- **Comandos de Texto (80*)**:
  - **Caracteres Prohibidos**: El símbolo `$` causa NAK en muchos firmwares. Debe evitarse en etiquetas y montos referenciales.
  - **Separador Decimal**: Utilizar siempre la coma `,`. Algunos firmwares rechazan el punto `.` en comandos de texto no fiscal.
- **Consecuencia de error**: La impresora devuelve `NAK` (21) y reporta "Error de Protocolo" o "Inconsistencia de Datos".

### 2. Configuración de Puerto (Baudrate)
- **Velocidad Estándar**: **9600** baudios.
- **Paridad**: `even` (par).
- **Data Bits**: 8.
- **Stop Bits**: 1.
- **Señales**: `DTR/RTS` deben estar activos (`true`) para que la impresora abra el buffer de recepción.

### 3. Checksum (LRC)
- **Algoritmo**: XOR acumulativo de todos los bytes de la DATA + el byte ETX (3).
- **Exclusión**: El byte STX (2) **NUNCA** se incluye en el cálculo del LRC en el protocolo Z1F puro.
- **Trama Final**: `[STX, ...DATA, ETX, LRC]`

### 4. Interpretación de Respuestas
- **ACK (0x06)**: Comando aceptado.
- **NAK (0x15)**: Error.
- **Lectura S1 (Correlativo)**: El número de factura se encuentra en el reporte `S1`, usualmente tras la segunda partición de salto de línea (`\n`).

## Estrategia de Rollback
- Siempre mantener una rama `stable-hka-ng` con la versión de padding 33 válida.
- No aplicar bloqueos preventivos `Swal` basados en bytes de estado; preferir notificaciones informativas para permitir que el hardware maneje las excepciones.

Pachacutec.
