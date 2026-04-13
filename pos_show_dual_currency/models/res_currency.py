from odoo import models, api
from odoo.exceptions import AccessError

class ResCurrency(models.Model):
    _inherit = 'res.currency'

    @api.model
    def _load_pos_data(self, data):
        # Pachacutec: v18.0.1.0.94 - SPECIFIC SHIELD
        return super(ResCurrency, self.sudo())._load_pos_data(data)

    def write(self, vals):
        # Pachacutec: v18.0.1.1.2 - WRITE SHIELD
        # La localización venezolana a menudo actualiza tasas o metadatos durante la operación.
        # Intentamos la escritura estándar; si falla por permisos (cajeros), elevamos quirúrgicamente.
        try:
            return super().write(vals)
        except AccessError:
            if self.env.context.get('pos_session_id') or self.env.context.get('pos_config_id'):
                return super(ResCurrency, self.sudo()).write(vals)
            raise
