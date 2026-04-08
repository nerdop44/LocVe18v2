# Contexto del Proyecto: LocVe18v2

## Estrella del Norte
Asegurar la estabilidad y despliegue de la localización venezolana optimizada para Odoo 18.

## Configuración del Entorno
- **Repositorio Local**: `/home/nerdop/laboratorio/LocVe18v2`
- **Remoto Localización (Principal)**: [git@github.com:nerdop44/LocVe18v2.git]
- **Repositorio Odoo.sh (Destino)**: git@github.com:tbriceno65/AnimalC.git
- **Rama de Producción Odoo.sh**: produccion
- **SSH Producción**: `29159705@tbriceno65-animalc.odoo.com`
- **URL Producción**: `https://tbriceno65-animalc.odoo.com`
- **DB Producción**: `tbriceno65-animalc-produccion-29159705`

## Variables de Sincronización (Odoo Sync Master)
[REPO_SUBMODULE_PATH]: /home/nerdop/laboratorio/LocVe18v2
[MAIN_REPO_SSH]: git@github.com:tbriceno65/AnimalC.git
[SUBMODULE_PATH_IN_MAIN]: nerdop44/LocVe18v2
[SUBMODULE_REMOTE_SSH]: git@github.com:nerdop44/LocVe18v2.git

## Bitácora de Trazabilidad
- [2026-03-01 12:05]: Sincronización de contexto solicitada por el usuario. Confirmado SSH producción: `29159705@tbriceno65-animalc.odoo.com`.
- [2026-03-02 11:40]: FIX: Corregido error de carga en POS (@pos_salesman) para Odoo 18. Despliegue completado en ramas `Dep3` (Prueba) y `Produccion`. Versión incrementada a `18.0.1.0.5`.
- [2026-03-03]: FASE 21: Estabilización Funcional y Precios Reactivos.
  - Definición del campo ausente `inverse_rate` en `res.currency`.
  - Sincronización bidireccional instantánea de `list_price` y `standard_price` en `product.template`.
  - Corrección de prefijos `@odoo-module` en JS de `pos_salesman` para habilitar botón en POS.
  - Refactorización de componentes XML (`pos_show_dual_currency`) para visualización premium de Restante y Vuelto en divisas.
  - Habilitación del cobro automático de IGTF (3%) para pagos en efectivo en divisas.
- [2026-03-30]: FASE 22: Estabilización POS Fiscal y Sincronización Dual.
  - v139 (18.0.1.3.7): Implementación de `closePort()` y persistencia del campo `impresa`.
  - Sincronización exitosa en remotos `origin` (nerdop44) y `animalc` (tbriceno65) en ramas `Prueba` y `produccion`.
  - Corrección: Se restauró la rama `main` en `animalc` a su estado original (solo README.md) tras push accidental.
  - Estado: Pendiente de Upgrade de módulo en base de datos de producción por parte del usuario o nuevo agente.

