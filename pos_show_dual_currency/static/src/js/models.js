/** @odoo-module */

import { PosStore } from "@point_of_sale/app/store/pos_store";
import { patch } from "@web/core/utils/patch";

patch(PosStore.prototype, {
    async _processData(loadedData) {
        await super._processData(...arguments);

        let currencyRef = null;
        const sessionData = loadedData['pos.session'];

        if (sessionData) {
            // Priority 1: Check inside session record (injected by backend)
            // Case 1: Array of records
            if (Array.isArray(sessionData)) {
                if (sessionData.length > 0) {
                    currencyRef = sessionData[0].res_currency_ref;
                }
            }
            // Case 2: Object indexed by ID
            else if (typeof sessionData === 'object') {
                const keys = Object.keys(sessionData);
                if (keys.length > 0) {
                    currencyRef = sessionData[keys[0]].res_currency_ref;
                }
            }
        }

        // Priority 2: Check global keys (legacy/standard attempts)
        if (!currencyRef) {
            currencyRef = loadedData['res_currency_ref'] || (sessionData && sessionData.res_currency_ref);
        }

        this.res_currency_ref = currencyRef || null;

        console.log('[DUAL CURRENCY DEBUG] _processData loaded res_currency_ref:', this.res_currency_ref);
        console.log('[DUAL CURRENCY DEBUG] show_dual_currency config:', this.config.show_dual_currency);
    },
    format_currency_ref(amount) {
        if (!this.res_currency_ref) {
            console.warn('[DUAL CURRENCY DEBUG] format_currency_ref requested but no res_currency_ref');
            return "";
        }
        return this.env.utils.formatCurrency(amount, false, this.res_currency_ref);
    },
    get_product_price_ref_display(product) {
        // Helper to safely get product price for dual currency display
        // We use lst_price because get_display_price is not available on the product object in this context
        const price = product.lst_price || 0;
        if (this.config && this.config.show_currency_rate) {
            return this.format_currency_ref(price * this.config.show_currency_rate);
        }
        return "";
    },
    async getClosePosInfo() {
        const closingData = await this.data.call('pos.session', 'get_closing_control_data', [[this.session.id]]);
        const amount_authorized_diff_ref = closingData.amount_authorized_diff_ref;

        const info = await super.getClosePosInfo();
        const state_new = { notes: '', acceptClosing: false, payments: {}, notes_ref: '', acceptClosing_usd: false, payments_usd: {} };

        if (info.cash_control) { // Odoo 18 uses cash_control (snake_case)
            state_new.payments[info.default_cash_details.id] = { counted: 0, difference: -info.default_cash_details.amount, number: 0 };
            if (info.default_cash_details.default_cash_details_ref) {
                state_new.payments_usd[info.default_cash_details.default_cash_details_ref.id] = { counted: 0, difference: -info.default_cash_details.default_cash_details_ref.amount, number: 0 };
            }
        }

        if (info.non_cash_payment_methods && info.non_cash_payment_methods.length > 0) {
            info.non_cash_payment_methods.forEach(pm => {
                if (pm.type === 'bank') {
                    state_new.payments[pm.id] = { counted: this.env.utils.roundCurrency(pm.amount, this.currency), difference: 0, number: pm.number }
                }
            })
        }

        return {
            ...info,
            state: state_new,
            amount_authorized_diff_ref
        };
    }
});
