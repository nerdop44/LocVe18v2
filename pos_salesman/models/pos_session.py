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
        try:
            result = super()._loader_params_hr_employee()
        except AttributeError:
            result = {
                'search_params': {
                    'domain': [('company_id', '=', self.config_id.company_id.id)],
                    'fields': ['name', 'id'],
                }
            }
        
        # Combinar con nuestros vendedores usando OR (|)
        if self.config_id.salesman_ids:
            my_domain = [('id', 'in', self.config_id.salesman_ids.ids)]
            if result['search_params'].get('domain'):
                result['search_params']['domain'] = ['|'] + result['search_params']['domain'] + my_domain
            else:
                result['search_params']['domain'] = my_domain
        
        return result

    def _get_pos_ui_hr_employee(self, params):
        # Intentamos obtenerlo de super si existe (configuración nativa de pos_hr)
        res = []
        try:
            res = super()._get_pos_ui_hr_employee(params)
        except AttributeError:
            pass
        
        # Aseguramos que todos los vendedores del POS estén cargados
        salesman_ids = self.config_id.salesman_ids.ids
        current_ids = [r['id'] for r in res]
        
        if any(sid not in current_ids for sid in salesman_ids):
             missing_ids = [sid for sid in salesman_ids if sid not in current_ids]
             extra_res = self.env['hr.employee'].search_read(
                 domain=[('id', 'in', missing_ids)], 
                 fields=params['search_params']['fields']
             )
             res.extend(extra_res)
             
        # Marcamos a los que son vendedores específicamente para este POS
        for emp in res:
            emp['is_salesman'] = emp['id'] in salesman_ids
            
        return res