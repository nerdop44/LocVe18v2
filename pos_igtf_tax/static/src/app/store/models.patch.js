import { patch } from "@web/core/utils/patch";
import { PosOrder, PosOrderline, PosPayment } from "@point_of_sale/app/store/models";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { PosData } from "@point_of_sale/app/models/data_service";

// Pachacutec: v18.0.1.0.43 - REFACTORIZACIÓN PROFESIONAL POR EVENTOS
// Esta patch elimina el uso de loops reactivos (update) y se enfoca en acciones manuales
// de pago para estabilizar los totales y la memoria de Odoo 18.

// 1. Blindaje de Datos Iniciales
patch(PosData.prototype, {
    async localDeleteCascade() {
        window.__pachacutec_global_lock = true;
        try {
            return await super.localDeleteCascade(...arguments);
        } finally {
            window.__pachacutec_global_lock = false;
        }
    },
    async processDeletedRecords() {
        window.__pachacutec_global_lock = true;
        try {
            return await super.processDeletedRecords(...arguments);
        } finally {
            window.__pachacutec_global_lock = false;
        }
    }
});

patch(PosStore.prototype, {
    async syncAllOrders() {
        window.__pachacutec_global_lock = true;
        try {
            return await super.syncAllOrders(...arguments);
        } finally {
            window.__pachacutec_global_lock = false;
        }
    }
});

// 2. Blindaje de Productos y Líneas
patch(PosOrderline.prototype, {
    setup() {
        super.setup(...arguments);
        this.x_is_igtf_line = this.x_is_igtf_line || false;
        if (this.product_id?.isIgtfProduct) {
            this.x_is_igtf_line = true;
        }
    },
    export_as_JSON() {
        const result = super.export_as_JSON();
        result.x_is_igtf_line = this.x_is_igtf_line;
        return result;
    },
    init_from_JSON(json) {
        super.init_from_JSON(...arguments);
        this.x_is_igtf_line = json.x_is_igtf_line || false;
    }
});

// 3. Lógica de Pagos (Identificación por Configuración de Divisas)
patch(PosPayment.prototype, {
    get isForeignExchange() {
        // VERDAD PROFESIONAL: Solo depende del check de configuración en el método de pago
        return this.payment_method_id?.x_is_foreign_exchange || false;
    }
});

// 4. Lógica de Pedido: Gestión de IGTF por Eventos
patch(PosOrder.prototype, {
    setup() {
        super.setup(...arguments);
        this.__refreshing_igtf = false;
    },

    init_from_JSON(json) {
        super.init_from_JSON(...arguments);
    },

    // Blindaje de UI: Prevenir crash de etiquetas de recibo (pos_receipt_label)
    getDisplayData() {
        const originalLines = this.lines;
        // Filtramos preventivamente cualquier objeto que no sea un Record de Odoo válido
        const validLines = (originalLines || []).filter(l => l && typeof l.getIndexMaps === "function");
        
        this.lines = validLines;
        try {
            return super.getDisplayData(...arguments);
        } finally {
            this.lines = originalLines;
        }
    },

    // Getters de Cálculos
    get x_igtf_amount() {
        try {
            const paymentLines = this.payment_ids || [];
            const total = (this.lines || [])
                .filter((p) => p && !p.x_is_igtf_line)
                .reduce((acc, p) => acc + (p.get_price_with_tax() || 0), 0);
            
            if (total <= 0) return 0;

            const igtf_monto = paymentLines
                .filter((p) => p.isForeignExchange)
                .map(({ amount, payment_method_id }) => {
                    const percentage = payment_method_id?.x_igtf_percentage || 0;
                    return (amount || 0) * (percentage / 100);
                })
                .reduce((acc, amount) => acc + amount, 0);

            // Cap al 3% del total (o según configuración)
            const max_igtf = total * 0.03;
            return Math.min(igtf_monto, max_igtf);
        } catch (e) {
            return 0;
        }
    },

    // EVENTOS DE PAGO: Único disparador del recálculo de IGTF
    add_paymentline(payment_method) {
        const res = super.add_paymentline(...arguments);
        this.refreshIGTF();
        return res;
    },

    delete_paymentline(line) {
        const res = super.delete_paymentline(...arguments);
        this.refreshIGTF();
        return res;
    },

    refreshIGTF() {
        if (!this.models || this.isFinalizing || window.__pachacutec_global_lock || this.__refreshing_igtf) return;
        
        this.__refreshing_igtf = true;
        try {
            // SANEAMIENTO QUIRÚRGICO: Extirpar objetos "fantasma" que causan getIndexMaps crash
            this._pachacutec_force_clean_memory();

            const igtf_monto = this.x_igtf_amount;
            const config = this.config;
            const igtfProductPair = config?.x_igtf_product_id;

            // Buscamos la línea actual
            const currentIgtfLine = (this.lines || []).find(l => l && l.x_is_igtf_line && typeof l.getIndexMaps === "function");
            
            if (currentIgtfLine) {
                // ESTRATEGIA DELTA: Si es igual, ignorar para evitar oscilaciones de UI
                if (Math.abs(currentIgtfLine.price_unit - igtf_monto) < 0.01 && igtf_monto > 0) {
                    return;
                }
                currentIgtfLine.delete();
            }

            if (igtf_monto > 0 && igtfProductPair) {
                const product = this.models["product.product"]?.get(igtfProductPair[0]);
                if (product) {
                    this.models["pos.order_line"].create({
                        order_id: this,
                        product_id: product,
                        price_unit: igtf_monto,
                        qty: 1,
                        x_is_igtf_line: true
                    });
                }
            }
        } catch (e) {
            console.error("Pachacutec IGTF Refill Error:", e);
        } finally {
            this.__refreshing_igtf = false;
        }
    },

    _pachacutec_force_clean_memory() {
        if (!this.lines) return;
        const ghostIndices = [];
        for (let i = 0; i < this.lines.length; i++) {
            // Un objeto es "fantasma" si no es una instancia de Record de Odoo 18
            if (this.lines[i] && typeof this.lines[i].getIndexMaps !== "function") {
                ghostIndices.push(i);
            }
        }
        if (ghostIndices.length > 0) {
            console.warn(`Pachacutec: Extirpando ${ghostIndices.length} objetos fantasma de la memoria del pedido.`);
            for (let i = ghostIndices.length - 1; i >= 0; i--) {
                this.lines.splice(ghostIndices[i], 1);
            }
        }
    }
});

// 5. Soporte de Identificación de Producto
patch(PosStore.prototype, {
    get isIgtfProduct() {
        return (product) => {
            const config = this.config;
            return config?.x_igtf_product_id ? config.x_igtf_product_id[0] === product.id : false;
        };
    }
});
