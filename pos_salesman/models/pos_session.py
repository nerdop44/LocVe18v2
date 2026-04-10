from odoo import models, api

class PosSession(models.Model):
    _inherit = 'pos.session'

    @api.model
    def _load_pos_data_models(self, config_id):
        # Truth of Odoo 18: Add hr.employee to the list of models to load
        models = super()._load_pos_data_models(config_id)
        if 'hr.employee' not in models:
            models.append('hr.employee')
        return models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    @api.model
    def _load_pos_data_fields(self, config_id):
        """
        Pachacutec: v18.0.1.0.38 - SHIELD FIX
        This method is a safeguard. In Odoo 18, if a module overrides this 
        without calling super() properly (or if super() is empty), Odoo 
        only loads the specified fields. 
        We force 'use_pricelist' to avoid the KeyError: 'use_pricelist'.
        """
        fields = super()._load_pos_data_fields(config_id)
        
        # If fields list is not empty, it means someone is restricting it.
        # We must ensure 'use_pricelist' is present.
        if fields and 'use_pricelist' not in fields:
             fields.append('use_pricelist')
             
        # Add our own fields
        if 'salesman_ids' not in fields and fields:
            fields.append('salesman_ids')
            
        return fields