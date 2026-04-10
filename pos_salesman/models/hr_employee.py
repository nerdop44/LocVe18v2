from odoo import models, api

class HrEmployee(models.Model):
    _name = 'hr.employee'
    _inherit = ['hr.employee', 'pos.load.mixin']

    @api.model
    def _load_pos_data_fields(self, config_id):
        return ['name']

    @api.model
    def _load_pos_data_domain(self, data):
        config_id = data['pos.config']['data'][0]['id']
        config = self.env['pos.config'].browse(config_id)
        if config.salesman_ids:
            return [('id', 'in', config.salesman_ids.ids)]
        return []

    def _load_pos_data(self, data):
        # Override to ensure the data is returned in a format the frontend expects (hr_salesmen)
        # However, Odoo 18 loads it as 'hr.employee'. 
        # We will keep it as 'hr.employee' and adjust JS if needed, 
        # or we can keep the custom injection in pos.session for backward compatibility.
        return super()._load_pos_data(data)
