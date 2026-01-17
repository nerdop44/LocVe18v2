from odoo import api, fields, models, _


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    currency_id_dif = fields.Many2one("res.currency", related="company_id.currency_id_dif", string="Moneda Dual Ref.", readonly=False)
    igtf_divisa_porcentage = fields.Float(related='company_id.igtf_divisa_porcentage', readonly=False)
    aplicar_igtf_divisa = fields.Boolean(related='company_id.aplicar_igtf_divisa', readonly=False)
    account_debit_wh_igtf_id = fields.Many2one('account.account', related='company_id.account_debit_wh_igtf_id', readonly=False)
    account_credit_wh_igtf_id = fields.Many2one('account.account', related='company_id.account_credit_wh_igtf_id', readonly=False)

