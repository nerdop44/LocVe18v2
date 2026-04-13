
from functools import partial

from odoo import models, fields


class PosConfig(models.Model):
    _inherit = 'pos.config'

    salesman_ids = fields.Many2many('hr.employee', 'hr_employee_pos_config_rel_salesman', 'pos_config_id', 'hr_employee_id', string="Vendedores")

    def _load_pos_data(self, data):
        # Pachacutec: v18.0.1.0.46 - SHIELD FIX
        # Elevamos a sudo para evitar que la lectura de Many2many a empleados 
        # dispare errores de campos privados de nómina.
        return super(PosConfig, self.sudo())._load_pos_data(data)
