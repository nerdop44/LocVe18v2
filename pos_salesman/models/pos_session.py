from odoo import models, api, fields

class PosConfig(models.Model):
    _inherit = 'pos.config'

    @api.model
    def _load_pos_data_fields(self, config_id):
        # Pachacutec: v85 - Carga nativa de vendedores en Odoo 18
        return super()._load_pos_data_fields(config_id) + ['salesman_ids']

class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    @api.model
    def _load_pos_data_fields(self, config_id):
        # Pachacutec: v18 - Usar el método estándar para evitar errores de getIndexMaps
        res = super()._load_pos_data_fields(config_id)
        # No añadimos 'name' porque ya está en el core de pos_hr
        return res

    # Pachacutec: v205 - ELIMINADO filtro de dominio restrictivo.
    # El filtrado de vendedores se debe manejar solo en el frontend (BtnSalesMan.js)
    # para no bloquear la carga de cajeros/managers legítimos en Odoo 18.