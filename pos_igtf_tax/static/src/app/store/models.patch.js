import { patch } from "@web/core/utils/patch";
import { PosOrder, PosOrderline, PosPayment } from "@point_of_sale/app/store/models";

// Pachacutec: v18.0.1.0.45 - SIMPLIFICACIÓN TOTAL Y ESTABILIZACIÓN
// Eliminamos todas las dependencias externas inestables (PosData, PosStore)
// para garantizar que el POS abra y funcione sin errores de carga.

// 1. Identificación de Línea IGTF en el Pedido
patch(PosOrderline.prototype, {
    setup() {
        super.setup(...arguments);
        this.x_is_igtf_line = this.x_is_igtf_line || false;
        
        // Auto-detección basada en la configuración inyectada
        const config = this.models?.["pos.config"]?.getFirst();
        if (config?.x_igtf_product_id && this.product_id && config.x_igtf_product_id[0] === this.product_id.id) {
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

// 2. Identificación de Divisas en Pagos
patch(PosPayment.prototype, {
    get isForeignExchange() {
        // Se basa estrictamente en la configuración del método de pago del backend
        return this.payment_method_id?.x_is_foreign_exchange || false;
    }
});

// 3. Gestión de Lógica IGTF por Eventos
patch(PosOrder.prototype, {
    setup() {
        super.setup(...arguments);
        this.__refreshing_igtf = false;
    },

    // Blindaje de UI: Evita errores al intentar leer etiquetas de líneas corruptas
    getDisplayData() {
        const originalLines = this.lines;
        const validLines = (originalLines || []).filter(l => l && typeof l.getIndexMaps === "function");
        this.lines = validLines;
        try {
            return super.getDisplayData(...arguments);
        } finally {
            this.lines = originalLines;
        }
    },

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
                    const percentage = payment_method_id?.x_igtf_percentage || 3.0;
                    return (amount || 0) * (percentage / 100);
                })
                .reduce((acc, amount) => acc + amount, 0);

            // Capped al 3% del total base para evitar excedentes por redondeo
            return Math.min(igtf_monto, total * 0.031); 
        } catch (e) {
            return 0;
        }
    },

    // Disparadores de Pago
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

    // Método de Saneamiento y Cálculo
    refreshIGTF() {
        if (this.isFinalizing || this.__refreshing_igtf || !this.models) return;
        
        this.__refreshing_igtf = true;
        try {
            // Saneamiento Quirúrgico Interno: Elimina basura de memoria que causa crash getIndexMaps
            if (this.lines) {
                const ghosts = [];
                for (let i = 0; i < this.lines.length; i++) {
                    if (this.lines[i] && typeof this.lines[i].getIndexMaps !== "function") ghosts.push(i);
                }
                if (ghosts.length > 0) {
                    console.warn(`Pachacutec: Limpiando ${ghosts.length} objetos corruptos del pedido.`);
                    for (let i = ghosts.length - 1; i >= 0; i--) {
                        this.lines.splice(ghosts[i], 1);
                    }
                }
            }

            const igtf_monto = this.x_igtf_amount;
            const config = this.models["pos.config"].getFirst();
            const igtfProdId = config?.x_igtf_product_id?.[0];

            const current = (this.lines || []).find(l => l && l.x_is_igtf_line && typeof l.getIndexMaps === "function");
            
            if (current) {
                // Estrategia Delta
                if (Math.abs(current.price_unit - igtf_monto) < 0.01 && igtf_monto > 0) return;
                current.delete();
            }

            if (igtf_monto > 0 && igtfProdId) {
                const product = this.models["product.product"].get(igtfProdId);
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
            console.error("Pachacutec: Error en refreshIGTF", e);
        } finally {
            this.__refreshing_igtf = false;
        }
    }
});
