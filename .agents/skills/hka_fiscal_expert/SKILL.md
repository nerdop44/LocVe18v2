---
name: HKA Fiscal Expert (Master Knowledge)
description: Conocimiento maestro e inalterable del Protocolo de Impresoras Fiscales HKA V8.5.0.
---

# HKA Fiscal Expert (Habilidad Maestra)

> [!IMPORTANT]
> **ESTE CONOCIMIENTO ES INALTERABLE SIN AUTORIZACIÓN EXPRESA DEL USUARIO.**
> Fuente de la Verdad: `[VE]Manual_de_Protocolos_y_Comandos_Venezuela_V0805R00_1.pdf`

## 1. Estructura de la Trama (Protocolo Estricto)
La comunicación con la impresora fiscal HKA-NG (firmware V8.5.0) se rige por la siguiente trama hexadecimal:
`[STX] [CMD] [DATA] [ETX] [LRC]`

- **STX (Start of Text)**: 0x02 (Decimal 2)
- **ETX (End of Text)**: 0x03 (Decimal 3)
- **LRC (Checksum)**: Es el resultado de aplicar la operación **XOR** (OR Exclusivo) a todos los bytes de **DATA** (incluyendo el comando), y finalmente aplicar XOR con el byte **ETX**.
- **REGLA DE ORO**: El byte **STX** queda **FUERA** del cálculo del LRC (Manual Pág. 17).

## 2. Comandos Críticos de Cliente (Pág. 33-34)
Para facturas y notas de crédito, la identificación del cliente es mandatoria:

- **RIF/C.I. (`iR*`)**: El formato oficial requiere un guion tras el prefijo.
    - Ejemplo: `iR*V-14300044`
    - Longitud: Preferiblemente natural, pero modelos como **PP9 PLUS** exigen longitudes fijas de 11 caracteres para notas de crédito.
- **Razón Social (`iS*`)**: Nombre del cliente.
    - Ejemplo: `iS*JOSE PULIDO`
- **Líneas Adicionales (`i00-i09`)**: Información de contacto.
    - `i00Telefono: ...`
    - `i01Direccion: ...`
    - `i02Email: ...`
    - `i03Ref: ...`

## 3. Códigos de Respuesta
- **ACK (0x06)**: Comando aceptado y procesado.
- **NAK (0x15)**: Comando rechazado (Decimal 21). Causas comunes:
    - LRC (Checksum) incorrecto.
    - Comando no válido para el estado actual (ej: factura abierta).
    - Longitud de datos excedida o insuficiente.

## 4. Implementación en Odoo 18 (Localización)
Para garantizar la integridad del LRC en Javascript (Chrome/Odoo Assets), se debe evitar el uso de bucles `for...of` sobre strings, ya que el motor de optimización JIT puede causar truncados erráticos. Se debe usar **siempre** un bucle de índice tradicional sobre un `Uint8Array`.

```javascript
// Implementación Maestra en v168
let lrc = 0;
for (let i = 0; i < data.length; i++) {
    lrc ^= data[i];
}
lrc ^= 3; // ETX
```
