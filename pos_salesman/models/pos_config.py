from odoo import models, fields, api

class PosConfig(models.Model):
    _inherit = 'pos.config'

    salesman_ids = fields.Many2many('hr.employee', 'hr_employee_pos_config_rel_salesman', 'pos_config_id', 'hr_employee_id', string="Vendedores")

    @api.model
    def _load_pos_data_fields(self, config_id):
        # Pachacutec: v77 - Cargar salesman_ids de forma nativa en Odoo 18
        return super()._load_pos_data_fields(config_id) + ['salesman_ids']
