/** @odoo-module */

import { ProductProduct } from "@point_of_sale/app/models/product_product";
import { PosPayment } from "@point_of_sale/app/models/pos_payment";
import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { PosData } from "@point_of_sale/app/models/data_service";
import DevicesSynchronisation from "@point_of_sale/app/store/devices_synchronisation";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { patch } from "@web/core/utils/patch";
import { roundDecimals } from "@web/core/utils/numbers";

// Pachacutec: v18 - Registro formal de campos para evitar errores de getIndexMaps
// PosOrderline es un módulo independiente, podemos registrarlo aquí.
PosOrderline.fields = {
    ...PosOrderline.fields,
    x_is_igtf_line: { type: "boolean" },
};

window.__pachacutec_global_lock = false;

// 1. Identificación del Producto IGTF
patch(ProductProduct.prototype, {
    get isIgtfProduct() {
        const config = this.models?.["pos.config"]?.getFirst();
        if (!config || !config.x_igtf_product_id) return false;
        const igtfProduct = config.x_igtf_product_id;
        const igtfProductId = Array.isArray(igtfProduct) 
            ? igtfProduct[0] 
            : (typeof igtfProduct === 'object' ? igtfProduct.id : igtfProduct);
        return igtfProductId === this.id;
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
        const pm = this.payment_method_id;
        if (pm) {
            console.log(`[IGTF DEBUG JS] PM Name: ${pm.name}, keys: ${Object.keys(pm).slice(0, 30)}, x_is_foreign_exchange: ${pm.x_is_foreign_exchange}`);
        }
        return this.payment_method_id?.x_is_foreign_exchange || false;
    },
    set_amount(value) {
        console.log("[IGTF DEBUG JS] set_amount called with value: " + value + ", order: " + (this.pos_order_id ? "YES" : "NO"));
        if (window.__pachacutec_global_lock) return super.set_amount(value);
        
        super.set_amount(value);
        
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
    _pachacutec_is_ghost(line) {
        return line && typeof line.getIndexMaps !== "function";
    },

    // Eliminados overrides virtuales de get_total_with_tax y get_total_without_tax
    // para usar el cálculo nativo de Odoo 18 basado en la línea de IGTF física.

    getDisplayData() {
        return super.getDisplayData(...arguments);
    },

    get sale_total_without_igtf() {
        // Pachacutec: v18.0.1.2.13 - Cálculo DIRECTO desde las líneas de productos.
        // NO usar get_total_with_tax() porque cuando existe la línea física de IGTF
        // ese método ya la incluye, produciendo una resta circular en el panel visual.
        return (this.lines || [])
            .filter((l) => l && !l.x_is_igtf_line && !this._pachacutec_is_ghost(l))
            .map((l) => typeof l.get_price_with_tax === "function" ? l.get_price_with_tax() : 0)
            .reduce((a, b) => a + b, 0);
    },

    get total_with_igtf() {
        // Pachacutec: v18.0.1.2.13 - Suma ADITIVA: subtotal_productos + IGTF.
        // El IGTF es un servicio que se agrega encima del total de venta, no dentro.
        return this.sale_total_without_igtf + this.x_igtf_amount;
    },

    get igtf_base_bs() {
        // Pachacutec: v76 - Base de cálculo del IGTF (Suma de montos en divisas)
        const paymentLines = (this.payment_ids || []).filter(p => p && p.payment_method_id);
        return paymentLines
            .filter((p) => p.isForeignExchange)
            .map((p) => p.amount || 0)
            .reduce((prev, current) => prev + current, 0);
    },

    get x_igtf_amount() {
        if (window.__pachacutec_global_lock || !this.models) return 0;
        try {
            const config = this.config;
            const companyId = Array.isArray(config.company_id) ? config.company_id[0] : config.company_id;
            const company = this.models["res.company"]?.get(companyId);
            if (!company || company.taxpayer_type !== 'special') {
                return 0;
            }

            const percentage = config?.x_igtf_percentage || 3.0;
            const paymentLines = (this.payment_ids || []).filter(p => p && p.payment_method_id);
            const totalPagosDivisas = paymentLines
                .filter((p) => p.isForeignExchange)
                .map((p) => p.amount || 0)
                .reduce((prev, current) => prev + current, 0);

            const totalProductos = (this.lines || [])
                .filter((p) => p && !p.x_is_igtf_line && !this._pachacutec_is_ghost(p))
                .map((p) => typeof p.get_price_with_tax === "function" ? p.get_price_with_tax() : 0)
                .reduce((prev, current) => prev + current, 0);

            const baseIGTF = Math.min(totalPagosDivisas, totalProductos);

            return roundDecimals(baseIGTF * (percentage / 100), 2);
        } catch (e) {
            console.error("Pachacutec: Error in x_igtf_amount:", e);
            return 0;
        }
    },
    set x_igtf_amount(value) { },

    update(vals, opts) {
        if (window.__pachacutec_global_lock) {
            super.update(vals, opts);
            return;
        }
        try {
            super.update(vals, opts);
        } catch (e) {
            if (e.message && e.message.includes("getIndexMaps")) {
                console.warn("Pachacutec: Supressing getIndexMaps crash during update", e);
            } else {
                throw e;
            }
        }
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
            try {
                this.refreshIGTF();
            } catch (e) {
                console.warn("Pachacutec: refreshIGTF failed during remove_paymentline", e);
            }
        }
    },

    refreshIGTF() {
        console.log("[IGTF DEBUG JS] refreshIGTF called! finalized: " + this.finalized + ", lock: " + window.__pachacutec_global_lock);
        if (!this.models || this.finalized || window.__pachacutec_global_lock) return;
        
        try {
            this.removeIGTF();
            const config = this.config;
            const igtfProduct = config?.x_igtf_product_id;
            const price = this.x_igtf_amount;

            if (igtfProduct && Math.abs(price) > 0.001) {
                const igtfProductId = Array.isArray(igtfProduct) 
                    ? igtfProduct[0] 
                    : (typeof igtfProduct === 'object' ? igtfProduct.id : igtfProduct);
                const product = this.models["product.product"]?.get(igtfProductId);
                console.log(`[IGTF DEBUG JS] Found IGTF Product ID: ${igtfProductId}, Object:`, product);
                if (product) {
                    const newLine = this.models["pos.order.line"].create({
                        order_id: this,
                        product_id: product,
                        price_unit: price,
                        qty: 1,
                        price_type: "manual",
                        x_is_igtf_line: true,
                        tax_ids: []
                    });
                    if (newLine && typeof newLine.setLinePrice === "function") {
                        newLine.setLinePrice();
                    }
                    this.recomputeOrderData();
                } else {
                    console.error(`[IGTF DEBUG JS] Product with ID ${igtfProductId} NOT found in cache!`);
                }
            }
        } catch (e) {
            console.error("Pachacutec: Error refreshing IGTF:", e);
        }
    },

    removeIGTF() {
        if (window.__pachacutec_global_lock || !this.models) return;
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
    },

    recomputeOrderData() {
        if (this.lines) {
            this.lines.forEach((line) => {
                if (line && typeof line.setLinePrice === "function") {
                    line.setLinePrice();
                }
            });
        }
        super.recomputeOrderData();
    },

    getDefaultAmountDueToPayIn(paymentMethod) {
        const baseAmount = super.getDefaultAmountDueToPayIn(paymentMethod);
        if (paymentMethod && paymentMethod.x_is_foreign_exchange && baseAmount > 0) {
            const config = this.config;
            const companyId = Array.isArray(config.company_id) ? config.company_id[0] : config.company_id;
            const company = this.models["res.company"]?.get(companyId);
            if (!company || company.taxpayer_type !== 'special') {
                return baseAmount;
            }

            const percentage = paymentMethod.x_igtf_percentage || 3.0;
            
            const paymentLines = (this.payment_ids || []).filter(p => p && p.payment_method_id);
            const totalPagosDivisas = paymentLines
                .filter((p) => p.isForeignExchange)
                .map((p) => p.amount || 0)
                .reduce((prev, current) => prev + current, 0);

            const totalProductos = (this.lines || [])
                .filter((p) => p && !p.x_is_igtf_line && !this._pachacutec_is_ghost(p))
                .map((p) => typeof p.get_price_with_tax === "function" ? p.get_price_with_tax() : 0)
                .reduce((prev, current) => prev + current, 0);

            const saldoRestanteProductos = Math.max(0, totalProductos - totalPagosDivisas);
            const montoBaseSujetoAIGTF = Math.min(baseAmount, saldoRestanteProductos);
            return baseAmount + (montoBaseSujetoAIGTF * (percentage / 100));
        }
        return baseAmount;
    },

    export_for_printing() {
        const result = super.export_for_printing(...arguments);
        result.x_igtf_amount = this.x_igtf_amount;
        result.total_with_igtf = this.total_with_igtf;
        return result;
    }
});

// Pachacutec: v18 - Parche para PosStore para limpiar órdenes zombies y estabilizar envío
patch(PosStore.prototype, {
    async afterProcessServerData() {
        try {
            await this.purgeGhostOrders();
        } catch (e) {
            console.error("Pachacutec: purgeGhostOrders failed:", e);
        }
        return await super.afterProcessServerData(...arguments);
    },

    async syncAllOrders(options = {}) {
        // Obtenemos los pedidos a procesar
        const { orderToCreate, orderToUpdate } = this.getPendingOrder();
        const orders = options.orders || [...orderToCreate, ...orderToUpdate];
        for (const order of orders) {
            if (order && !order.finalized && typeof order.refreshIGTF === "function") {
                try {
                    order.refreshIGTF();
                    order.recomputeOrderData();
                } catch (e) {
                    console.error("Pachacutec: refreshIGTF failed in syncAllOrders", e);
                }
            }
        }
        return await super.syncAllOrders(...arguments);
    },

    async purgeGhostOrders() {
        if (!this.models || !this.session) return;
        const currentSessionId = this.session.id;
        
        // Buscamos todas las órdenes del store local
        const orders = this.models["pos.order"]?.getAll() || [];
        
        // Filtramos órdenes que:
        // 1. Tengan un ID de tipo string (lo que indica que se generó de manera local, ej. uuid o temp_id)
        // 2. O tengan un session_id diferente de la sesión actual.
        // 3. No estén finalizadas.
        const ghostOrders = orders.filter(order => {
            if (order.finalized) return false;
            
            const orderSessionId = order.session_id ? (Array.isArray(order.session_id) ? order.session_id[0] : (typeof order.session_id === 'object' ? order.session_id.id : order.session_id)) : null;
            
            const isLocalId = typeof order.id === 'string';
            const isDifferentSession = !orderSessionId || (orderSessionId !== currentSessionId);
            
            return isLocalId && isDifferentSession;
        });

        if (ghostOrders.length > 0) {
            console.log(`Pachacutec: Purging ${ghostOrders.length} ghost orders from previous sessions.`, ghostOrders);
            for (const order of ghostOrders) {
                try {
                    // localDeleteCascade limpia todas las líneas de la orden y la elimina del data service.
                    this.data.localDeleteCascade(order);
                } catch (e) {
                    console.error("Pachacutec: Failed to delete ghost order", order.id, e);
                }
            }
        }
    }
});
