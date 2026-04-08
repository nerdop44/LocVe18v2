/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { PosData } from "@point_of_sale/app/models/data_service";
// import { formatMonetary } from "@web/views/fields/formatters"; // Possible missing module in some asset bundles

// Patch PosData to intercept the load_data result
patch(PosData.prototype, {
    async loadInitialData() {
        try {
            // Pachacutec: v197.3 - Refuerzo de Resiliencia.
            const response = await super.loadInitialData(...arguments);
            
            if (!response || typeof response !== 'object') {
                console.warn(">>>>>>>> PosData Patched (v197.3): El servidor devolvió una respuesta nula o inválida. Aplicando objeto vacío de emergencia.");
                return {};
            }

            // Inject hr_salesmen into the data service for reactivity in Odoo 18
            if (response.hr_salesmen) {
                this.hr_salesmen = response.hr_salesmen;
            } else if (response["pos.config"] && response["pos.config"].data && response["pos.config"].data[0].hr_salesmen) {
                this.hr_salesmen = response["pos.config"].data[0].hr_salesmen;
            }

            if (response && response.res_currency_ref) {
                console.log(">>>>>>>> Intercepted res_currency_ref in PosData Root:", response.res_currency_ref);
            } else if (response && response["pos.session"]) {
                const sessionModel = response["pos.session"];
                const res_currency_ref = sessionModel.res_currency_ref || (sessionModel.data && sessionModel.data[0] ? sessionModel.data[0].res_currency_ref : null);
                if (res_currency_ref) {
                    console.log(">>>>>>>> Intercepted res_currency_ref in PosData (Session lvl):", res_currency_ref);
                }
            }
            
            return response;
        } catch (error) {
            console.error(">>>>>>>> PosData Patched (v197.3): Error crítico capturado en loadInitialData.", error);
            return {};
        }
    },
});

// Patch PosStore to use the intercepted data
patch(PosStore.prototype, {
    get res_currency_ref() {
        return this.get_currency_ref();
    },

    get_currency_ref() {
        // 1. Try accessing from PosData if available (this.data is commonly the data service in Odoo 18 PosStore)
        if (this.data && this.data.res_currency_ref) {
            return this.data.res_currency_ref;
        }

        // 2. Fallback to session data if DataService interceptor is still loading or using old structure
        if (this.models && this.models["pos.session"] && this.models["pos.session"].data && this.models["pos.session"].data[0]) {
            return this.models["pos.session"].data[0].res_currency_ref;
        }
        return null;
    },

    format_currency_ref(value) {
        // Obtenemos la moneda de referencia inyectada desde el backend
        const currency_ref = this.res_currency_ref;
        if (!currency_ref) return value;

        const decimals = currency_ref.decimal_places || 2;
        const symbol = currency_ref.symbol || '';
        const position = currency_ref.position || 'after';

        // Formateo profesional: puntos para miles, comas para decimales
        const parts = value.toFixed(decimals).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        const formatted_val = parts.join(',');

        return position === 'before' ? `${symbol} ${formatted_val}` : `${formatted_val} ${symbol}`;
    },

    getAmountInRefCurrency(base_amount, apply_inverse = false) {
        /**
         * Pachacutec: v197.2
         * Convierte montos a la moneda de referencia (USD o Bs según configuración).
         */
        const config = this.config;
        if (!config || !config.show_currency_rate) return this.format_currency_ref(base_amount);

        const rate = config.show_currency_rate;
        const ref_symbol = config.show_currency_symbol;
        
        // Logical Fallback: If rate is 1 and symbols match, no conversion needed.
        if (rate === 1 && ref_symbol === (this.currency ? this.currency.symbol : '')) {
            return this.format_currency_ref(base_amount);
        }

        let final_val = 0;
        
        // --- USD -> Bs Conversion Logic ---
        // If the shop is in USD (Base) and we want to show Bs (Reference)
        // Rate from backend is usually 1 USD = X Bs.
        if (apply_inverse) {
             // We want to go from Bs (Base) to USD (Reference)
             // Backend usually provides rate as X (where 1 USD = X Bs) but we already inverted it in backend for USD dual currency.
             // If base_amount is Bs and rate is Bs/USD, we divide.
             final_val = base_amount * rate;
        } else {
             final_val = base_amount * rate;
        }

        // Now process like usual with base_amount (USD)
        if (ref_symbol === '$' || ref_symbol === 'USD') {
            // Base is USD, we want USD.
            final_val = base_amount;
        } else {
            // Base is USD, we want Bs (Reference). Multiply.
            final_val = base_amount * rate;
        }

        return this.format_currency_ref(final_val);
    },

    getProductPriceFormatted(product, ref = false) {
        try {
            if (!product) return "";

            // Pachacutec: Priorizamos los campos cargados directamente del backend para evitar desincronización
            if (ref && product.list_price_usd && product.list_price_usd > 0) {
                // Si el producto tiene el campo maestro USD inyectado y es mayor a cero, lo usamos directamente
                return this.format_currency_ref(product.list_price_usd);
            }

            // Para el precio principal (Bs), usamos el campo lst_price nativo que ya viene calculado desde el backend
            let price = product.lst_price || 0;

            // Incluimos impuestos si aplica (la lógica nativa get_price podría ser necesaria para pricelists)
            if (this.pricelist) {
                try {
                    price = product.get_price(this.pricelist, 1);
                } catch (e) { }
            }

            const price_with_tax = this.get_product_price_with_tax(product, price);

            if (ref) {
                // Fallback si no hay list_price_usd: dividir por la tasa del sistema
                return this.getAmountInRefCurrency(price_with_tax, true);
            }

            if (this.currency) {
                // Pachacutec: Eliminamos la multiplicación redundante por rate. 
                // Aplicamos el mismo formato profesional (puntos para miles, comas para decimales)
                const decimals = this.currency.decimal_places || 2;
                const parts = price_with_tax.toFixed(decimals).split('.');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                const formatted_val = parts.join(',');

                const curr_sym = typeof this.currency.symbol === 'symbol' ? '' : (this.currency.symbol || '');
                return (this.currency.position === 'before' ? curr_sym + ' ' : '') +
                    formatted_val +
                    (this.currency.position === 'after' ? ' ' + curr_sym : '');
            }
            return "" + price_with_tax.toFixed(2);
        } catch (e) {
            console.error("Error in getProductPriceFormatted:", e);
            return "";
        }
    },

    get_product_price_with_tax(product, price) {
        if (!product.taxes_id || product.taxes_id.length === 0) return price;

        let taxes = [];
        // 1. Try checking this.taxes (Odoo 16/17 style)
        if (this.taxes) {
            taxes = this.taxes.filter(t => product.taxes_id.includes(t.id));
        } else if (this.taxes_by_id) {
            taxes = product.taxes_id.map(id => this.taxes_by_id[id]).filter(Boolean);
        }

        // 2. Try checking Odoo 18 models service style
        if (taxes.length === 0 && this.models && this.models['account.tax']) {
            try {
                // If it's a DataStore collection
                const taxModel = this.models['account.tax'];
                if (typeof taxModel.getAll === 'function') {
                    taxes = taxModel.getAll().filter(t => product.taxes_id.includes(t.id));
                } else if (Array.isArray(taxModel)) {
                    taxes = taxModel.filter(t => product.taxes_id.includes(t.id));
                } else if (taxModel.data) {
                    taxes = taxModel.data.filter(t => product.taxes_id.includes(t.id));
                }
            } catch (e) { console.error("Error accessing models['account.tax']", e); }
        }

        if (taxes.length === 0) return price;

        try {
            // Compute taxes
            // Logic adapted for Odoo 18/Owl where compute_all might be a utility
            // or we use a simplified calculation for display if compute_all is missing

            if (typeof this.compute_all === 'function') {
                // compute_all(taxes, price, quantity, currency)
                var all_taxes = this.compute_all(taxes, price, 1, this.currency.id);
                return all_taxes.total_included;
            } else if (this.get_taxes_after_fp) {
                // Fallback if compute_all is missing logic (unlikely in POS)
                return price;
            }
        } catch (error) {
            console.error("Error calculating tax:", error);
            return price;
        }
        return price;
    },

    get show_currency_rate_display() {
        const rate = this.config.show_currency_rate || 0;
        return rate.toFixed(4);
    }
});
