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
        
        _logger.info(">>>>>>>> [pos_salesman] Diagnostic: data keys: %s", list(data.keys()))
        _logger.info(">>>>>>>> [pos_salesman] Diagnostic: config_id found: %s", config_id)
        
        if not config_id:
            _logger.warning(">>>>>>>> [pos_salesman] Diagnostic: No config_id found in data!")
            return []
        
        config = self.env['pos.config'].sudo().browse(config_id)
        _logger.info(">>>>>>>> [pos_salesman] Diagnostic: POS Company: %s", config.company_id.name)
        
        if config.salesman_ids:
            salesman_ids = config.salesman_ids.ids
            _logger.info(">>>>>>>> [pos_salesman] Diagnostic: Salesmen IDs defined: %s", salesman_ids)
            return [('id', 'in', salesman_ids)]
            
        # Fallback: Si no hay específicos, filtramos por la compañía del POS
        domain = [('company_id', '=', config.company_id.id)]
        _logger.info(">>>>>>>> [pos_salesman] Diagnostic: No specific salesmen. Fallback domain: %s", domain)
        return domain

class AccountTax(models.Model):
    _inherit = "account.tax"

    @api.model
    def _load_pos_data_fields(self, config_id):
        # Pachacutec: v53 - ESCUDO DE EMERGENCIA: Asegurar que pos_receipt_label se cargue para evitar el crash del POS
        res = super()._load_pos_data_fields(config_id)
        # Solo añadimos si no existe ya ante una posible colisión
        if 'pos_receipt_label' not in res:
            res.append('pos_receipt_label')
        return res

    def _load_pos_data(self, data):
        # Pachacutec: v18.0.1.0.45 - SHIELD FIX
        # Elevamos a sudo() para ignorar campos privados de nómina que causan AccessError
        _logger.info(">>>>>>>> [pos_salesman] Diagnostic: _load_pos_data triggered for hr.employee")
        return super(HrEmployee, self.sudo())._load_pos_data(data)
