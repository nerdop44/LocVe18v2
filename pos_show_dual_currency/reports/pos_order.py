# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
from datetime import timedelta
from functools import partial
from itertools import groupby
from collections import defaultdict

import psycopg2
import pytz
import re

from odoo import api, fields, models, tools, _
from odoo.tools import float_is_zero, float_round, float_repr, float_compare
from odoo.exceptions import ValidationError, UserError
from odoo.osv.expression import AND
import base64

_logger = logging.getLogger(__name__)


class ReportSaleDetails(models.AbstractModel):
    _inherit = 'report.point_of_sale.report_saledetails'

    @api.model
    def get_sale_details(self, date_start=False, date_stop=False, config_ids=False, session_ids=False):
        data = super(ReportSaleDetails, self).get_sale_details(date_start, date_stop, config_ids, session_ids)
        
        pos_session = self.env['pos.session'].search([('id', 'in', session_ids)])
        rate_today = 1
        if pos_session and pos_session[0].tax_today != 0:
            rate_today = pos_session[0].tax_today
            
        currency_id_dif = self.env.company.currency_id_dif
        data.update({
            'currency_precision_ref': currency_id_dif.decimal_places,
            'symbol_ref': currency_id_dif.symbol,
            'symbol': self.env.company.currency_id.symbol,
            'rate_today': rate_today,
            'total_paid_ref': currency_id_dif.round(data.get('total_paid', 0) / rate_today),
        })

        # Process Products (Nested in Odoo 18)
        products_categories = data.get('products', [])
        for category in products_categories:
            # We add total_ref to category for the category row
            category['total_ref'] = currency_id_dif.round(category.get('total', 0) / rate_today)
            for line in category.get('products', []):
                # Calculate unit price ref from base_amount to be more accurate
                qty = line.get('quantity', 0)
                line['price_unit_ref'] = (line.get('base_amount', 0) / qty) / rate_today if qty else 0
        
        # Update products_info for totals
        if 'products_info' in data:
            data['products_info']['total_ref'] = currency_id_dif.round(data['products_info'].get('total', 0) / rate_today)
            
        # Update taxes with ref values
        taxes = data.get('taxes', [])
        for tax in taxes:
            tax['tax_amount_ref'] = currency_id_dif.round(tax.get('tax_amount', 0) / rate_today)
            tax['base_amount_ref'] = currency_id_dif.round(tax.get('base_amount', 0) / rate_today)

        if 'taxes_info' in data:
            data['taxes_info']['tax_amount_ref'] = currency_id_dif.round(data['taxes_info'].get('tax_amount', 0) / rate_today)
            data['taxes_info']['base_amount_ref'] = currency_id_dif.round(data['taxes_info'].get('base_amount', 0) / rate_today)

        # Update payments
        for payment in data.get('payments', []):
            # Odoo 18 uses 'total' in the basic list and 'final_count' in session details
            amount = payment.get('total') or payment.get('final_count', 0)
            payment['total_ref'] = currency_id_dif.round(amount / rate_today)

        return data

    def update_key_values_data(self, date_start=False, date_stop=False, config_ids=False, session_ids=False):
        domain = [('state', 'in', ['paid', 'invoiced', 'done'])]
        if (session_ids):
            domain = AND([domain, [('session_id', 'in', session_ids)]])
        else:
            if date_start:
                date_start = fields.Datetime.from_string(date_start)
            else:
                # start by default today 00:00:00
                user_tz = pytz.timezone(self.env.context.get('tz') or self.env.user.tz or 'UTC')
                today = user_tz.localize(fields.Datetime.from_string(fields.Date.context_today(self)))
                date_start = today.astimezone(pytz.timezone('UTC'))

            if date_stop:
                date_stop = fields.Datetime.from_string(date_stop)
                # avoid a date_stop smaller than date_start
                if (date_stop < date_start):
                    date_stop = date_start + timedelta(days=1, seconds=-1)
            else:
                # stop by default today 23:59:59
                date_stop = date_start + timedelta(days=1, seconds=-1)

            domain = AND([domain,
                          [('date_order', '>=', fields.Datetime.to_string(date_start)),
                           ('date_order', '<=', fields.Datetime.to_string(date_stop))]
                          ])

            if config_ids:
                domain = AND([domain, [('config_id', 'in', config_ids)]])

        orders = self.env['pos.order'].search(domain)
        user_currency = self.env.company.currency_id
        total = 0.0
        total_ref = 0.0
        products_sold = {}
        taxes = {}
        for order in orders:
            if user_currency != order.pricelist_id.currency_id:
                total += order.pricelist_id.currency_id._convert(
                    order.amount_total, user_currency, order.company_id, order.date_order or fields.Date.today())
            else:
                total += order.amount_total
            total_ref += order.amount_total_ref
            currency = order.session_id.currency_id

            for line in order.lines:
                key = (line.product_id, line.price_unit, line.price_unit_ref, line.discount)
                products_sold.setdefault(key, 0.0)
                products_sold[key] += line.qty

                if line.tax_ids_after_fiscal_position:
                    line_taxes = line.tax_ids_after_fiscal_position.sudo().compute_all(
                        line.price_unit * (1 - (line.discount or 0.0) / 100.0), currency, line.qty,
                        product=line.product_id, partner=line.order_id.partner_id or False)
                    for tax in line_taxes['taxes']:
                        taxes.setdefault(tax['id'], {'name': tax['name'], 'tax_amount': 0.0, 'base_amount': 0.0,
                                                     'tax_amount_ref': 0.0, 'base_amount_ref': 0.0})
                        taxes[tax['id']]['tax_amount'] += tax['amount']
                        taxes[tax['id']]['base_amount'] += tax['base']
                        if order.session_rate != 0:
                            tax_amount_ref = tax['amount']/order.session_rate
                            base_amount_ref = tax['base']/order.session_rate
                            taxes[tax['id']]['tax_amount_ref'] += tax_amount_ref
                            taxes[tax['id']]['base_amount_ref'] += base_amount_ref
                else:
                    taxes.setdefault(0, {'name': _('No Taxes'), 'tax_amount': 0.0, 'base_amount': 0.0,
                                         'tax_amount_ref': 0.0, 'base_amount_ref': 0.0})
                    taxes[0]['base_amount'] += line.price_subtotal_incl
                    taxes[0]['base_amount_ref'] += line.price_subtotal_incl_ref

        payment_ids = self.env["pos.payment"].search([('pos_order_id', 'in', orders.ids)]).ids
        if payment_ids:
            self.env.cr.execute("""
                        SELECT COALESCE(method.name->>%s, method.name->>'en_US') as name, sum(amount) total, sum(amount_ref) total_ref
                        FROM pos_payment AS payment,
                             pos_payment_method AS method
                        WHERE payment.payment_method_id = method.id
                            AND payment.id IN %s
                        GROUP BY method.name
                    """, (self.env.lang, tuple(payment_ids),))
            payments = self.env.cr.dictfetchall()
        else:
            payments = []

        return {
            'total_paid_ref': self.env.company.currency_id_dif.round(total_ref),
            'taxes': list(taxes.values()),
            'payments': payments,
            'products': sorted([{
                'product_id': product.id,
                'product_name': product.name,
                'code': product.default_code,
                'quantity': qty,
                'price_unit': price_unit,
                'price_unit_ref': price_unit_ref,
                'discount': discount,
                'uom': product.uom_id.name,
            } for (product, price_unit, price_unit_ref, discount), qty in products_sold.items()],
                key=lambda l: l['product_name'])

        }
