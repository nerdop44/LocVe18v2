# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api

class PosSession(models.Model):
    _inherit = 'pos.session'

    @api.model
    def _loader_params_pos_config(self):
        # Odoo 18 Loader Chain Restoration
        # Aseguramos que use_pricelist esté presente para evitar KeyError en pos_config.py:283
        result = super()._loader_params_pos_config()
        fields = result['search_params']['fields']
        if 'salesman_ids' not in fields:
            fields.append('salesman_ids')
        if 'use_pricelist' not in fields:
            fields.append('use_pricelist')
        return result

    @api.model
    def _loader_params_hr_employee(self):
        result = super()._loader_params_hr_employee()
        # Aseguramos que los campos necesarios estén para los vendedores
        if 'name' not in result['search_params']['fields']:
            result['search_params']['fields'].append('name')
        return result