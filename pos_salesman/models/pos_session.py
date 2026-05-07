from odoo import models, api, fields

class PosConfig(models.Model):
    _inherit = 'pos.config'

    @api.model
    def _load_pos_data(self, data):
        # Pachacutec: v18 - Inyectar salesman_ids de forma segura
        # Odoo 18 pos.config retorna {'data': [...], 'fields': [...]}
        res = super()._load_pos_data(data)
        
        # Obtenemos el config_id desde la sesión cargada previamente
        try:
            config_id = data['pos.session']['data'][0]['config_id']
            config = self.browse(config_id)
            
            if isinstance(res, dict) and 'data' in res and len(res['data']) > 0:
                res['data'][0]['salesman_ids'] = config.salesman_ids.ids
            elif isinstance(res, list) and len(res) > 0:
                res[0]['salesman_ids'] = config.salesman_ids.ids
        except (KeyError, IndexError, TypeError):
            pass
            
        return res

class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    @api.model
    def _load_pos_data_domain(self, data):
        # Pachacutec: v18 - Inyectar vendedores configurados en el dominio de carga
        # Odoo 18 pos.session ya debe estar en data
        try:
            config_id_val = data['pos.session']['data'][0]['config_id']
            config_id = self.env['pos.config'].browse(config_id_val)
        except (KeyError, IndexError, TypeError):
            return super()._load_pos_data_domain(data)
            
        # Obtener dominio base
        domain = []
        try:
            domain = super()._load_pos_data_domain(data)
        except AttributeError:
            domain = [('company_id', '=', config_id.company_id.id)]
        
        if config_id.salesman_ids:
            domain = ['|'] + domain + [('id', 'in', config_id.salesman_ids.ids)]
        
        return domain

    @api.model
    def _load_pos_data_fields(self, config_id):
        # Pachacutec: v18 - Asegurar campos requeridos
        return super()._load_pos_data_fields(config_id) + ['name']