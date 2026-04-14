import logging
from odoo import models, api

_logger = logging.getLogger(__name__)

class HrEmployee(models.Model):
    _name = 'hr.employee'
    _inherit = ['hr.employee', 'pos.load.mixin']

    @api.model
    def _load_pos_data_fields(self, config_id):
        # Pachacutec: v53 - FIX: Usar super() para no borrar campos de otros módulos (IGTF/Localización)
        res = super()._load_pos_data_fields(config_id)
        if 'name' not in res:
            res.append('name')
        return res

    @api.model
    def _load_pos_data_domain(self, data):
        # Pachacutec: v18.0.1.0.52 - DIAGNOSTIC INSTRUMENTATION
        config_data_obj = data.get('pos.config', {})
        config_list = config_data_obj.get('data', []) if isinstance(config_data_obj, dict) else config_data_obj
        config_id = config_list[0].get('id') if config_list else None
        
        if not config_id:
            return []
        
        config = self.env['pos.config'].sudo().browse(config_id)
        
        if config.salesman_ids:
            salesman_ids = config.salesman_ids.ids
            return [('id', 'in', salesman_ids)]
            
        # Fallback: Si no hay específicos, filtramos por la compañía del POS
        domain = [('company_id', '=', config.company_id.id)]
        return domain

    def _load_pos_data(self, data):
        # Pachacutec: v18.0.1.0.45 - SHIELD FIX REPAIRED (v55)
        _logger.info(">>>>>>>> [pos_salesman] Diagnostic: _load_pos_data triggered for hr.employee")
        return super(HrEmployee, self.sudo())._load_pos_data(data)

class AccountTax(models.Model):
    _inherit = "account.tax"

    @api.model
    def _load_pos_data_fields(self, config_id):
        # Pachacutec: v56 - REMOVE POISON PILL
        # Se elimina la referencia a pos_receipt_label ya que no existe en el esquema de Odoo 18
        # y causa ValueError: Invalid field 'pos_receipt_label' on model 'account.tax'
        res = super()._load_pos_data_fields(config_id)
        return res
