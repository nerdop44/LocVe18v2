from odoo import models, api

class HrEmployee(models.Model):
    _name = 'hr.employee'
    _inherit = ['hr.employee', 'pos.load.mixin']

    @api.model
    def _load_pos_data_fields(self, config_id):
        return ['name']

    @api.model
    def _load_pos_data_domain(self, data):
        # Pachacutec: v18.0.1.0.45 - SHIELD FIX
        # Usamos sudo() para acceder a la configuración y sus relaciones
        config_id = data.get('pos.config', {}).get('data', [{}])[0].get('id')
        if not config_id:
            return []
        config = self.env['pos.config'].sudo().browse(config_id)
        if config.salesman_ids:
            return [('id', 'in', config.salesman_ids.ids)]
        return []

    def _load_pos_data(self, data):
        # Pachacutec: v18.0.1.0.45 - SHIELD FIX
        # Elevamos a sudo() para ignorar campos privados de nómina que causan AccessError
        return super(HrEmployee, self.sudo())._load_pos_data(data)
