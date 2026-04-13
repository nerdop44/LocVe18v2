from odoo import models, api

class ResCurrency(models.Model):
    _inherit = 'res.currency'

    @api.model
    def _load_pos_data(self, data):
        # Pachacutec: v18.0.1.0.94 - SPECIFIC SHIELD
        # La localización venezolana a veces intenta actualizar tasas durante la lectura.
        # Elevamos a sudo() específicamente para la moneda para evitar AccessError (write)
        # sin romper el contexto de la sesión en el POS.
        return super(ResCurrency, self.sudo())._load_pos_data(data)
