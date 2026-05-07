from odoo import models, api

class PosSession(models.Model):
    _inherit = 'pos.session'

    def _pos_ui_models_to_load(self):
        result = super()._pos_ui_models_to_load()
        if 'hr.employee' not in result:
            result.append('hr.employee')
        return result

    def _loader_params_pos_config(self):
        result = super()._loader_params_pos_config()
        if 'salesman_ids' not in result['search_params']['fields']:
            result['search_params']['fields'].extend(['salesman_ids'])
        return result

    def _loader_params_hr_employee(self):
        domain = [('company_id', '=', self.config_id.company_id.id)]
        if self.config_id.salesman_ids:
            domain = [('id', 'in', self.config_id.salesman_ids.ids)]
        return {
            'search_params': {
                'domain': domain,
                'fields': ['name', 'id'],
            }
        }

    def _get_pos_ui_hr_employee(self, params):
        return self.env['hr.employee'].search_read(**params['search_params'])