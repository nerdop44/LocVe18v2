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
        # 1. Obtener la zona horaria del usuario
        user_tz = pytz.timezone(self.env.context.get('tz') or self.env.user.tz or 'UTC')
        
        # 2. Buscar las órdenes del dominio
        orders_domain = [('state', 'in', ['paid', 'invoiced', 'done'])]
        if session_ids:
            orders_domain = AND([orders_domain, [('session_id', 'in', session_ids)]])
        else:
            if date_start:
                orders_domain = AND([orders_domain, [('date_order', '>=', date_start)]])
            if date_stop:
                orders_domain = AND([orders_domain, [('date_order', '<=', date_stop)]])
            if config_ids:
                orders_domain = AND([orders_domain, [('config_id', 'in', config_ids)]])
                
        orders = self.env['pos.order'].search(orders_domain)
        
        comp_currency = self.env.company.currency_id
        ref_currency = self.env.company.currency_id_dif
        is_company_usd = comp_currency.name == 'USD'
        symbol_local = comp_currency.symbol or 'Bs.'
        symbol_ref = ref_currency.symbol if ref_currency and ref_currency.symbol and ref_currency.symbol != symbol_local else '$'
        currency_precision_ref = ref_currency.decimal_places if ref_currency else 2

        def enrich_data_dict(data_dict, rate):
            # Helper de conversión inteligente
            def convert_amount(amount):
                if is_company_usd:
                    return amount * rate
                else:
                    return amount / rate

            # total_paid
            total_paid = data_dict.get('total_paid', 0.0)
            data_dict['total_paid_ref'] = ref_currency.round(convert_amount(total_paid))

            # Categorías de productos
            for category in data_dict.get('products', []):
                total = category.get('total', 0.0)
                category['total_ref'] = convert_amount(total)
                for prod in category.get('products', []):
                    price_unit = prod.get('price_unit') or prod.get('price', 0.0)
                    base_amount = prod.get('base_amount', 0.0)
                    prod['price_unit_ref'] = convert_amount(price_unit)
                    prod['base_amount_ref'] = convert_amount(base_amount)
                    
            if 'products_info' in data_dict and data_dict['products_info']:
                total = data_dict['products_info'].get('total', 0.0)
                data_dict['products_info']['total_ref'] = convert_amount(total)

            # Devoluciones
            for category in data_dict.get('refund_products', []):
                total = category.get('total', 0.0)
                category['total_ref'] = convert_amount(total)
                for prod in category.get('products', []):
                    price_unit = prod.get('price_unit') or prod.get('price', 0.0)
                    base_amount = prod.get('base_amount', 0.0)
                    prod['price_unit_ref'] = convert_amount(price_unit)
                    prod['base_amount_ref'] = convert_amount(base_amount)
                    
            if 'refund_info' in data_dict and data_dict['refund_info']:
                total = data_dict['refund_info'].get('total', 0.0)
                data_dict['refund_info']['total_ref'] = convert_amount(total)

            # Pagos
            for payment in data_dict.get('payments', []):
                total = payment.get('total', 0.0)
                final_count = payment.get('final_count', 0.0)
                money_counted = payment.get('money_counted', 0.0)
                money_difference = payment.get('money_difference', 0.0)
                
                payment['total_ref'] = convert_amount(total)
                payment['final_count_ref'] = convert_amount(final_count)
                payment['money_counted_ref'] = convert_amount(money_counted)
                payment['money_difference_ref'] = convert_amount(money_difference)
                
                if 'cash_moves' in payment:
                    for cm in payment['cash_moves']:
                        amount = cm.get('amount', 0.0)
                        cm['amount_ref'] = convert_amount(amount)

            # Payments per method
            if 'payments_per_method' in data_dict and data_dict['payments_per_method'] is not None:
                data_dict['payments_per_method'] = list(data_dict['payments_per_method'])
            for ppm in data_dict.get('payments_per_method', []):
                total = ppm.get('total', 0.0)
                ppm['total_ref'] = convert_amount(total)

            # Impuestos
            for tax in data_dict.get('taxes', []):
                tax_amount = tax.get('tax_amount', 0.0)
                base_amount = tax.get('base_amount', 0.0)
                tax['tax_amount_ref'] = convert_amount(tax_amount)
                tax['base_amount_ref'] = convert_amount(base_amount)
                
            if 'taxes_info' in data_dict and data_dict['taxes_info']:
                tax_amount = data_dict['taxes_info'].get('tax_amount', 0.0)
                base_amount = data_dict['taxes_info'].get('base_amount', 0.0)
                data_dict['taxes_info']['tax_amount_ref'] = convert_amount(tax_amount)
                data_dict['taxes_info']['base_amount_ref'] = convert_amount(base_amount)

            # Impuestos de devoluciones
            for tax in data_dict.get('refund_taxes', []):
                tax_amount = tax.get('tax_amount', 0.0)
                base_amount = tax.get('base_amount', 0.0)
                tax['tax_amount_ref'] = convert_amount(tax_amount)
                tax['base_amount_ref'] = convert_amount(base_amount)
                
            if 'refund_taxes_info' in data_dict and data_dict['refund_taxes_info']:
                tax_amount = data_dict['refund_taxes_info'].get('tax_amount', 0.0)
                base_amount = data_dict['refund_taxes_info'].get('base_amount', 0.0)
                data_dict['refund_taxes_info']['tax_amount_ref'] = convert_amount(tax_amount)
                data_dict['refund_taxes_info']['base_amount_ref'] = convert_amount(base_amount)

            # Descuentos
            discount_amount = data_dict.get('discount_amount', 0.0)
            data_dict['discount_amount_ref'] = convert_amount(discount_amount)

            # Facturas
            for inv in data_dict.get('invoiceList', []):
                if 'invoices' in inv:
                    for invoice in inv['invoices']:
                        total = invoice.get('total', 0.0)
                        invoice['total_ref'] = convert_amount(total)
            invoice_total = data_dict.get('invoiceTotal', 0.0)
            data_dict['invoiceTotal_ref'] = convert_amount(invoice_total)

        if not orders:
            data = super(ReportSaleDetails, self).get_sale_details(date_start, date_stop, config_ids, session_ids)
            rate_today = self.env.company.currency_id_dif.get_trm_systray() or 1.0
            try:
                rate_today = float(rate_today)
            except:
                rate_today = 1.0
            if not rate_today or rate_today <= 0:
                rate_today = 1.0
                
            enrich_data_dict(data, rate_today)
            data.update({
                'days_data': [],
                'currency_precision_ref': currency_precision_ref,
                'symbol_ref': symbol_ref,
                'symbol': symbol_local,
                'rate_today': rate_today,
                'igtf_totals': {
                    'total_igtf_bs': 0.0,
                    'total_igtf_ref': 0.0,
                    'total_igtf_base_bs': 0.0,
                    'total_igtf_base_ref': 0.0,
                },
            })
            return data
            
        # 3. Agrupar las órdenes por fecha local (día)
        orders_by_day = defaultdict(list)
        for order in orders:
            date_utc = pytz.utc.localize(order.date_order)
            date_local = date_utc.astimezone(user_tz)
            day_str = date_local.strftime('%Y-%m-%d')
            orders_by_day[day_str].append(order)
            
        sorted_days = sorted(orders_by_day.keys())
        
        # 4. Para cada día, obtener sus datos individuales de ventas
        days_data = []
        for day_str in sorted_days:
            day_orders = orders_by_day[day_str]
            # Determinar el rango de fecha en UTC para este día local (00:00:00 - 23:59:59)
            day_local_start = user_tz.localize(fields.Datetime.from_string(f"{day_str} 00:00:00"))
            day_local_end = user_tz.localize(fields.Datetime.from_string(f"{day_str} 23:59:59"))
            
            day_utc_start = day_local_start.astimezone(pytz.utc).replace(tzinfo=None)
            day_utc_end = day_local_end.astimezone(pytz.utc).replace(tzinfo=None)
            
            day_session_ids = list(set(o.session_id.id for o in day_orders if o.session_id))
            
            # Si se pasaron session_ids al reporte original, filtramos usando day_session_ids
            if session_ids:
                day_sessions_filtered = [s for s in day_session_ids if s in session_ids]
                if not day_sessions_filtered:
                    continue
                day_data = super(ReportSaleDetails, self).get_sale_details(
                    date_start=fields.Datetime.to_string(day_utc_start),
                    date_stop=fields.Datetime.to_string(day_utc_end),
                    config_ids=config_ids,
                    session_ids=day_sessions_filtered
                )
            else:
                day_data = super(ReportSaleDetails, self).get_sale_details(
                    date_start=fields.Datetime.to_string(day_utc_start),
                    date_stop=fields.Datetime.to_string(day_utc_end),
                    config_ids=config_ids,
                    session_ids=False
                )
                
            # Determinar inteligentemente la tasa de cambio de este día
            day_sessions = self.env['pos.session'].browse(day_session_ids)
            rate_today = 1.0
            sessions_with_rate = day_sessions.filtered(lambda s: s.tax_today > 0)
            if sessions_with_rate:
                rate_today = sessions_with_rate[0].tax_today
            else:
                rate_today = self.env.company.currency_id_dif.get_trm_systray() or 1.0
                try:
                    rate_today = float(rate_today)
                except:
                    rate_today = 1.0
            if not rate_today or rate_today <= 0:
                rate_today = 1.0
                
            # Enriquecemos day_data con los campos del día
            day_data['day_date'] = day_str
            day_data['rate_today'] = rate_today
            day_data['symbol'] = symbol_local
            day_data['symbol_ref'] = symbol_ref
            day_data['currency_precision_ref'] = currency_precision_ref
            
            # Helper de conversión inteligente local
            def convert_amount_local(amount):
                if is_company_usd:
                    return amount * rate_today
                else:
                    return amount / rate_today

            # Enriquecer usando el helper
            enrich_data_dict(day_data, rate_today)
            
            # IGTF del día
            day_orders_recs = self.env['pos.order'].browse([o.id for o in day_orders])
            day_payments = day_orders_recs.payment_ids
            
            igtf_product_ids = self.env['pos.config'].search([]).mapped('x_igtf_product_id.id')
            day_lines = day_orders_recs.mapped('lines').filtered(
                lambda l: l.x_is_igtf_line or (l.product_id and l.product_id.id in igtf_product_ids)
            )
            total_igtf_bs = sum(day_lines.mapped('price_subtotal_incl'))
            
            total_igtf_base_bs = sum(day_payments.filtered(lambda p: p.payment_method_id.x_is_foreign_exchange).mapped('amount'))
            
            day_data['igtf_totals'] = {
                'total_igtf_bs': total_igtf_bs,
                'total_igtf_ref': convert_amount_local(total_igtf_bs),
                'total_igtf_base_bs': total_igtf_base_bs,
                'total_igtf_base_ref': convert_amount_local(total_igtf_base_bs),
            }
            
            days_data.append(day_data)
            
        # 5. Retornar los datos agrupados enriqueciendo también la raíz
        global_data = super(ReportSaleDetails, self).get_sale_details(date_start, date_stop, config_ids, session_ids)
        last_day_data = days_data[-1] if days_data else global_data
        rate_global = last_day_data.get('rate_today', 1.0)
        
        enrich_data_dict(global_data, rate_global)
        
        def convert_amount_global(amount):
            if is_company_usd:
                return amount * rate_global
            else:
                return amount / rate_global

        global_data.update({
            'days_data': days_data,
            'currency_precision_ref': currency_precision_ref,
            'symbol_ref': symbol_ref,
            'symbol': symbol_local,
            'rate_today': rate_global,
            'igtf_totals': last_day_data.get('igtf_totals', {
                'total_igtf_bs': 0.0,
                'total_igtf_ref': 0.0,
                'total_igtf_base_bs': 0.0,
                'total_igtf_base_ref': 0.0,
            }),
        })
        
        return global_data

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
        payments = []
        if payment_ids:
            # Pachacutec: v18.0.1.1.4 - Migración a ORM para evitar KeyError: 'name' en traducciones SQL
            payment_groups = self.env['pos.payment'].read_group(
                [('id', 'in', payment_ids)],
                ['payment_method_id', 'amount', 'amount_ref'],
                ['payment_method_id']
            )
            for group in payment_groups:
                method_id, method_name = group['payment_method_id']
                payments.append({
                    'name': method_name,
                    'total': group['amount'],
                    'total_ref': group['amount_ref'],
                })

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
