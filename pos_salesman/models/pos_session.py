# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api


class PosSession(models.Model):
    _inherit = 'pos.session'

    def _loader_params_hr_employee(self):
        result = super()._loader_params_hr_employee()
        # Add basic fields for salesmen
        result['search_params']['fields'].extend(['name', 'id'])
        return result

    @api.model
    def _load_pos_data_fields(self, config_id):
        return super()._load_pos_data_fields(config_id) + ['salesman_ids']

    def _load_pos_data(self, *args, **kwargs):
        # Odoo 18: Usar el cargador estándar para inyectar hr_salesmen de forma reactiva
        # Pachacutec: v197.2 - Auditoría Profunda
        response = super()._load_pos_data(*args, **kwargs)
        
        salesman_ids = self.config_id.salesman_ids.ids if self.config_id else []
        
        domain = [('id', 'in', salesman_ids)] if salesman_ids else []
        salesmen = self.env['hr.employee'].search_read(
            domain,
            ['name', 'id']
        )
        
        # Inject into root response for JS PosData/PosStore interception
        response['hr_salesmen'] = salesmen
            
        return response
