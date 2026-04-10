# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api

class PosSession(models.Model):
    _inherit = 'pos.session'

    # Odoo 18: Loader for session specific data if needed
    @api.model
    def _load_pos_data_fields(self, config_id):
        return super()._load_pos_data_fields(config_id)

class PosConfig(models.Model):
    _inherit = 'pos.config'

    @api.model
    def _load_pos_data_fields(self, config_id):
        # Migramos la carga de campos al modelo correcto en Odoo 18 para evitar KeyError
        params = super()._load_pos_data_fields(config_id)
        params.append('salesman_ids')
        return params

class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    @api.model
    def _load_pos_data_fields(self, config_id):
        return super()._load_pos_data_fields(config_id) + ['name']