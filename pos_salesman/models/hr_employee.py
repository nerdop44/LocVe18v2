from odoo import models, api

class HrEmployee(models.Model):
    _name = 'hr.employee'
    _inherit = ['hr.employee', 'pos.load.mixin']

    @api.model
    def _load_pos_data_fields(self, config_id):
        return ['name']

    @api.model
    def _load_pos_data_domain(self, data):
        # Pachacutec: v18.0.1.0.51 - EMERGENCY DATA STRUCTURE FIX
        # En v18, cada modelo es un dict con llave 'data'.
        config_data_obj = data.get('pos.config', {})
        # Si ya es una lista es por una carga no estándar, manejamos ambos casos
        config_list = config_data_obj.get('data', []) if isinstance(config_data_obj, dict) else config_data_obj
        config_id = config_list[0].get('id') if config_list else None
        if not config_id:
            return []
        
        config = self.env['pos.config'].sudo().browse(config_id)
        if config.salesman_ids:
            return [('id', 'in', config.salesman_ids.ids)]
            
        # Fallback: Si no hay específicos, filtramos por la compañía del POS
        return [('company_id', '=', config.company_id.id)]

    def _load_pos_data(self, data):
        # Pachacutec: v18.0.1.0.45 - SHIELD FIX
        # Elevamos a sudo() para ignorar campos privados de nómina que causan AccessError
        return super(HrEmployee, self.sudo())._load_pos_data(data)
