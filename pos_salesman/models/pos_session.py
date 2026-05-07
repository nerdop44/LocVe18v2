from odoo import models, api, fields

class PosConfig(models.Model):
    _inherit = 'pos.config'

    @api.model
    def _load_pos_data(self, data):
        # Pachacutec: v18 - Inyectar salesman_ids de forma segura sin romper la lista de campos core (evita KeyError: 'use_pricelist')
        res = super()._load_pos_data(data)
        if res and len(res) > 0:
            config = self.browse(data['pos_config_id'])
            res[0]['salesman_ids'] = config.salesman_ids.ids
        return res

class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    @api.model
    def _load_pos_data_domain(self, data):
        # Pachacutec: v18 - Inyectar vendedores configurados en el dominio de carga
        config_id = self.env['pos.config'].browse(data['pos_config_id'])
        
        # Intentamos obtener el dominio base de pos_hr u otros módulos
        domain = []
        try:
            # En Odoo 18, super()._load_pos_data_domain(data) es el estándar
            domain = super()._load_pos_data_domain(data)
        except AttributeError:
            # Fallback si nadie más lo define
            domain = [('company_id', '=', config_id.company_id.id)]
        
        if config_id.salesman_ids:
            # Forzamos la inclusión de nuestros vendedores con un OR (|)
            # Esto asegura que aparezcan aunque no tengan usuario (pos_hr suele filtrar por user_id)
            domain = ['|'] + domain + [('id', 'in', config_id.salesman_ids.ids)]
        
        return domain

    @api.model
    def _load_pos_data_fields(self, config_id):
        # Pachacutec: v18 - Asegurar campos requeridos para la UI del selector de vendedores
        return super()._load_pos_data_fields(config_id) + ['name']