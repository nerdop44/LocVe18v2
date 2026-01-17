from odoo import api, fields, models, _, Command

class ResCompany(models.Model):
    _inherit = "res.company"

    currency_id_dif = fields.Many2one("res.currency",
                                      string="Moneda Dual Ref.",
                                      default=lambda self: self.env['res.currency'].search([('name', '=', 'USD')],
                                                                                           limit=1), )

    igtf_divisa_porcentage = fields.Float(string='Porcentaje IGTF Divisa', default=3.0)
    aplicar_igtf_divisa = fields.Boolean(string="Aplicar IGTF Divisa", default=True)
    account_debit_wh_igtf_id = fields.Many2one('account.account', string='Cuenta de IGTF Debito')
    account_credit_wh_igtf_id = fields.Many2one('account.account', string='Cuenta de IGTF Credito')