from odoo import models, api, fields

class PosConfig(models.Model):
    _inherit = 'pos.config'

    @api.model
    def _load_pos_data_fields(self, config_id):
        # Pachacutec: v18 - Migración a Loader nativo
        return super()._load_pos_data_fields(config_id) + ['salesman_ids']

class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    @api.model
    def _load_pos_data_domain(self, data):
        # Pachacutec: v18 - Inyectar vendedores configurados en el dominio de carga
        config_id = self.env['pos.config'].browse(data['pos_config_id'])
        # Obtenemos el dominio base si existe
        domain = []
        try:
            domain = super()._load_pos_data_domain(data)
        except AttributeError:
            domain = [('company_id', '=', config_id.company_id.id)]
        
        if config_id.salesman_ids:
            # Forzamos la inclusión de nuestros vendedores con un OR
            domain = ['|'] + domain + [('id', 'in', config_id.salesman_ids.ids)]
        
        return domain

    @api.model
    def _load_pos_data_fields(self, config_id):
        # Pachacutec: v18 - Asegurar campos requeridos para el botón de vendedores
        return super()._load_pos_data_fields(config_id) + ['name']