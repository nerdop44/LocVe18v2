from odoo import api, fields, models, _
from odoo.exceptions import AccessError

class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    @api.model
    def search_read(self, domain=None, fields=None, offset=0, limit=None, order=None, **read_kwargs):
        # Pachacutec: v18.0.1.1.2 - POS READ SHIELD
        # El POS en v18 carga datos de SaleOrderLine si hay combos o cotizaciones vinculados.
        # Como los cajeros no suelen tener permisos de Ventas, habilitamos lectura sudo() segura.
        try:
            return super().search_read(
                domain=domain, fields=fields, offset=offset, limit=limit, order=order, **read_kwargs
            )
        except AccessError:
            if self.env.context.get('pos_session_id') or self.env.context.get('pos_config_id'):
                return super(SaleOrderLine, self.sudo()).search_read(
                    domain=domain, fields=fields, offset=offset, limit=limit, order=order, **read_kwargs
                )
            raise

    def read(self, fields=None, load='_classic_read'):
        # Pachacutec: v18.0.1.1.2 - POS READ SHIELD
        try:
            return super().read(fields=fields, load=load)
        except AccessError:
            if self.env.context.get('pos_session_id') or self.env.context.get('pos_config_id'):
                return super(SaleOrderLine, self.sudo()).read(fields=None, load=load)
            raise
