from odoo import models, api, fields

class PosConfig(models.Model):
    _inherit = 'pos.config'

    def _load_pos_data_fields(self, config_id):
        # Pachacutec: v18 - Registro estándar de campos personalizados
        res = super()._load_pos_data_fields(config_id)
        if 'salesman_ids' not in res:
            res.append('salesman_ids')
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