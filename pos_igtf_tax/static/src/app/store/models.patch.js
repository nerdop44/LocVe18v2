/** @odoo-module */

import { ProductProduct } from "@point_of_sale/app/models/product_product";
import { PosPayment } from "@point_of_sale/app/models/pos_payment";
import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { PosData } from "@point_of_sale/app/models/data_service";
import DevicesSynchronisation from "@point_of_sale/app/store/devices_synchronisation";
import { patch } from "@web/core/utils/patch";
import { roundDecimals } from "@web/core/utils/numbers";

// v18.0.1.0.48 - ESTABILIZACIÓN REACTIVA
// Eliminamos splice destructivos y reforzamos bloqueos globales para evitar
// colisiones con syncAllOrders de Odoo 18.

window.__pachacutec_global_lock = false;

// 1. Identificación del Producto IGTF
patch(ProductProduct.prototype, {
    get isIgtfProduct() {
        const config = this.models?.["pos.config"]?.getFirst();
        return config?.x_igtf_product_id ? config.x_igtf_product_id[0] === this.id : false;
    }
});

// 2. Bloqueo de Sincronización (Evita cascadas reactivas durante purgas)
patch(PosData.prototype, {
    localDeleteCascade(record, removeFromServer = false) {
        window.__pachacutec_global_lock = true;
        try {
            return super.localDeleteCascade(...arguments);
        } catch (e) {
            console.error("Pachacutec: localDeleteCascade crash suppressed:", e);
            return true;
        } finally {
            window.__pachacutec_global_lock = false;
        }
    }
});

patch(DevicesSynchronisation.prototype, {
    processDeletedRecords(deletedRecords) {
        window.__pachacutec_global_lock = true;
        try {
            return super.processDeletedRecords(...arguments);
        } catch (e) {
            console.error("Pachacutec: processDeletedRecords crash suppressed during sync:", e);
            return true;
        } finally {
            window.__pachacutec_global_lock = false;
        }
    }
});

// 3. Lógica de Divisas en Pagos
patch(PosPayment.prototype, {
    get isForeignExchange() {
        return this.payment_method_id?.x_is_foreign_exchange || false;
    },
    set_amount(value) {
        if (window.__pachacutec_global_lock) return super.set_amount(value);
        
        const config = this.models?.["pos.config"]?.getFirst();
        let amount = value;
        if (this.isForeignExchange && this.pos_order_id && config) {
            const rate = config.show_currency_rate;
            if (rate && rate > 0 && rate < 1) {
                amount = value / rate;
            }
        }
        super.set_amount(amount);
        
        if (this.pos_order_id && !window.__pachacutec_global_lock && typeof this.pos_order_id.refreshIGTF === "function") {
            try {
                this.pos_order_id.refreshIGTF();
            } catch (e) {
                console.warn("Pachacutec: refreshIGTF failed during set_amount", e);
            }
        }
    }
});

// 4. Identificación de Línea IGTF
patch(PosOrderline.prototype, {
    setup() {
        super.setup(...arguments);
        this.x_is_igtf_line = this.x_is_igtf_line || false;
        if (this.product_id?.isIgtfProduct) {
            this.x_is_igtf_line = true;
        }
    },
    init_from_JSON(json) {
        super.init_from_JSON(...arguments);
        this.x_is_igtf_line = json.x_is_igtf_line;
    },
    export_as_JSON() {
        const result = super.export_as_JSON();
        result.x_is_igtf_line = this.x_is_igtf_line;
        return result;
    },
    export_for_printing() {
        const json = super.export_for_printing(...arguments);
        json.x_is_igtf_line = this.x_is_igtf_line;
        return json;
    }
});

// 5. Gestión de Pedido y Protección de Memoria
patch(PosOrder.prototype, {
    // Reducción del Escudo: Solo detección, nunca alteración directa del arreglo (NO splice)
    _pachacutec_is_ghost(line) {
        return line && typeof line.getIndexMaps !== "function";
    },

    getDisplayData() {
        return super.getDisplayData(...arguments);
    },

    get x_igtf_amount() {
        if (window.__pachacutec_global_lock || !this.models) return 0;
        try {
            const paymentLines = (this.payment_ids || []).filter(p => p && p.payment_method_id);
            const igtf_monto = paymentLines
                .filter((p) => p.isForeignExchange)
                .map(({ amount, payment_method_id }) => {
                    const percentage = payment_method_id?.x_igtf_percentage || 3.0;
                    return (amount || 0) * (percentage / 100);
                })
                .reduce((prev, current) => prev + current, 0);

            const totalBase = (this.lines || [])
                .filter((p) => p && !p.x_is_igtf_line && !this._pachacutec_is_ghost(p))
                .map((p) => typeof p.get_price_with_tax === "function" ? p.get_price_with_tax() : 0)
                .reduce((prev, current) => prev + current, 0);

            return roundDecimals(Math.min(igtf_monto, totalBase * 0.031), 2);
        } catch (e) {
            return 0;
        }
    },
    set x_igtf_amount(value) { },

    update(vals, opts) {
        if (window.__pachacutec_global_lock) {
            super.update(vals, opts);
            return;
        }
        super.update(vals, opts);
        if (vals.payment_ids && !window.__pachacutec_global_lock) {
            try {
                this.refreshIGTF();
            } catch (e) {
                console.warn("Pachacutec: refreshIGTF failed during update", e);
            }
        }
    },

    remove_paymentline(line) {
        super.remove_paymentline(line);
        if (!window.__pachacutec_global_lock) {
            this.refreshIGTF();
        }
    },

    refreshIGTF() {
        if (!this.models || this.finalized || window.__pachacutec_global_lock) return;
        
        window.__pachacutec_global_lock = true;
        try {
            this.removeIGTF();
            const config = this.models["pos.config"].getFirst();
            const igtf_monto = this.x_igtf_amount;
            const igtfProduct = config?.x_igtf_product_id;

            if (igtf_monto > 0.01 && igtfProduct) {
                const product = this.models["product.product"]?.get(igtfProduct[0]);
                if (product) {
                    this.update({
                        lines: [["create", {
                            product_id: product,
                            price_unit: igtf_monto,
                            qty: 1,
                            price_type: "original",
                            x_is_igtf_line: true
                        }]]
                    });
                    if (typeof this.recomputeOrderData === "function") {
                        this.recomputeOrderData();
                    }
                }
            }
        } catch (e) {
            console.error("Pachacutec: Error refreshing IGTF:", e);
        } finally {
            window.__pachacutec_global_lock = false;
        }
    },

    removeIGTF() {
        const linesToRemove = (this.lines || []).filter((l) => l && l.x_is_igtf_line);
        for (const line of linesToRemove) {
            if (line && !this._pachacutec_is_ghost(line) && typeof line.delete === "function") {
                try {
                    line.delete();
                } catch (e) {
                    console.warn("Pachacutec: Error deleting IGTF line", e);
                }
            }
        }
    }
});
