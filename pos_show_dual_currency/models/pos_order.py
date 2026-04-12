from odoo import api, fields, models, _
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)

class PosOrder(models.Model):
    _inherit = "pos.order"

    @api.model
    def _pachacutec_sanitize_uom_jit(self, orders):
        """
        Pachacutec: v18.0.1.0.87 - SANEAMIENTO UOM JIT (Migración v16 Fix)
        Detecta y corrige productos donde la variante no coincide con el template 
        en su categoría de UOM, evitando el error de sincronización.
        """
        product_ids = []
        for order in orders:
            order_data = order.get('data') or order
            for line in order_data.get('lines', []):
                # Odoo 18 lines format can vary [0, 0, {vals}] o {vals}
                vals = line[2] if isinstance(line, (list, tuple)) and len(line) > 2 else line
                pid = vals.get('product_id')
                if pid:
                    product_ids.append(pid)
        
        if product_ids:
            # Saneamos productos que participan en la orden (Fase 3 - Interceptación Total)
            misaligned_products = self.env['product.product'].sudo().search([
                ('id', 'in', product_ids),
            ]).filtered(lambda p: p.uom_id.category_id != p.product_tmpl_id.uom_id.category_id)
            
            for p in misaligned_products:
                template = p.product_tmpl_id
                _logger.warning("[UOM Fix] Saneamiento crítico JIT: Variante %s realineada con %s", 
                                p.display_name, template.uom_id.name)
                p.write({
                    'uom_id': template.uom_id.id,
                    'uom_po_id': template.uom_id.id
                })

    @api.model_create_multi
    def create_from_ui(self, orders):
        self._pachacutec_sanitize_uom_jit(orders)
        return super().create_from_ui(orders)

    @api.model
    def sync_from_ui(self, orders):
        # Pachacutec: Interceptamos la sincronización de fondo de Odoo 18
        self._pachacutec_sanitize_uom_jit(orders)
        return super().sync_from_ui(orders)

    ref_me_currency_id = fields.Many2one('res.currency', related='session_id.ref_me_currency_id',
                                         string="Reference Currency",
                                         store=False)
    session_rate = fields.Float(string="Session Rate", store=True,
                                related='session_id.tax_today',
                                digits=(16, 4))

    amount_tax_ref = fields.Float(string='Ref Taxes', compute='_compute_amount_all_ref', store=True)
    amount_total_ref = fields.Float(string='Ref Total', compute='_compute_amount_all_ref', store=True)
    amount_paid_ref = fields.Float(string='Ref Paid', compute='_compute_amount_all_ref', store=True)
    amount_return_ref = fields.Float(string='Ref Returned', compute='_compute_amount_all_ref', store=True)
    margin_ref = fields.Monetary(string="Ref Margin", compute='_compute_margin_ref', store=True)
    sum_amount_total_ref = fields.Float(string='Total Ref. Sum', compute='_compute_amount_all_ref', store=True)

    @api.depends('session_rate', 'margin')
    def _compute_margin_ref(self):
        for order in self:
            if order.session_rate != 0:
                order.margin_ref = order.margin * order.session_rate

            else:
                order.margin = 0

    @api.depends('amount_tax', 'amount_total', 'session_rate', 'amount_paid')
    def _compute_amount_all_ref(self):
        for order in self:
            if order.session_rate != 0:
                order.amount_paid_ref = order.amount_paid * order.session_rate
                order.amount_return_ref = order.amount_return * order.session_rate
                order.amount_tax_ref = order.amount_tax * order.session_rate
                order.amount_total_ref = order.amount_total * order.session_rate
                order.sum_amount_total_ref = order.amount_total * order.session_rate
            else:
                order.amount_paid_ref = 0
                order.amount_return_ref = 0
                order.amount_tax_ref = 0
                order.amount_total_ref = 0
                order.sum_amount_total_ref = 0
