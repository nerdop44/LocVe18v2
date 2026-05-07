from odoo import models, api, fields

class PosConfig(models.Model):
    _inherit = 'pos.config'

    @api.model
    def _load_pos_data(self, data):
        # Pachacutec: v18 - Inyectar salesman_ids de forma segura preservando la estructura core
        # Odoo 18 pos.config espera un dict {'data': [...], 'fields': [...]}
        res = super()._load_pos_data(data)
        
        try:
            # En Odoo 18, el config_id se puede obtener de la sesión cargada o del contexto
            config_id = self.env.context.get('pos_config_id') or (data.get('pos.session') and data['pos.session']['data'][0]['config_id'])
            if config_id:
                config = self.browse(config_id)
                if isinstance(res, dict) and 'data' in res and len(res['data']) > 0:
                    res['data'][0]['salesman_ids'] = config.salesman_ids.ids
                    # Pachacutec: v18 - Protección contra fallos de iteración en trusted_config_ids
                    if not res['data'][0].get('trusted_config_ids'):
                        res['data'][0]['trusted_config_ids'] = []
                    
                    if res.get('fields') and 'salesman_ids' not in res['fields']:
                        res['fields'].append('salesman_ids')
        except Exception:
            pass
            
        return res

class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    @api.model
    def _load_pos_data_fields(self, config_id):
        # Pachacutec: v18 - Usar el método estándar para evitar errores de getIndexMaps
        res = super()._load_pos_data_fields(config_id)
        # No añadimos 'name' porque ya está en el core de pos_hr
        return res

    @api.model
    def _load_pos_data_domain(self, data):
        # Pachacutec: v18 - Dominio filtrado por vendedores
        config_id_val = self.env.context.get('pos_config_id')
        if not config_id_val:
            try:
                config_id_val = data['pos.session']['data'][0]['config_id']
            except (KeyError, IndexError, TypeError):
                return super()._load_pos_data_domain(data)
        
        config = self.env['pos.config'].browse(config_id_val)
        domain = super()._load_pos_data_domain(data)
        
        if config.salesman_ids:
            domain = ['&'] + domain + [('id', 'in', config.salesman_ids.ids)]
        
        return domain