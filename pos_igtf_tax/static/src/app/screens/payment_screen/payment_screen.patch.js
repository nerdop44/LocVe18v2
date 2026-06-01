/** @odoo-module */

import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";
import { onMounted, onWillUnmount } from "@odoo/owl";

patch(PaymentScreen.prototype, {
    setup() {
        super.setup();

        onMounted(() => {
            // Pachacutec: v74 - Desactivamos removeIGTF al montar para evitar
            // parpadeos visuales y pérdida del total real al entrar a la pantalla.
            // if (this.currentOrder) {
            //     this.currentOrder.removeIGTF();
            // }
        });

        onWillUnmount(() => {
            if (this.currentOrder && typeof this.currentOrder.is_paid === 'function' && !this.currentOrder.is_paid()) {
                this.currentOrder.removeIGTF();
            }
        });
    },
    async addNewPaymentLine(paymentMethod) {
        console.log("[IGTF DEBUG JS] PaymentScreen.addNewPaymentLine called", paymentMethod?.name);
        const res = await super.addNewPaymentLine(...arguments);
        if (this.currentOrder && typeof this.currentOrder.refreshIGTF === "function") {
            try {
                this.currentOrder.refreshIGTF();
            } catch (e) {
                console.error("Pachacutec: refreshIGTF failed in addNewPaymentLine", e);
            }
        }
        return res;
    },
    deletePaymentLine(uuid) {
        console.log("[IGTF DEBUG JS] PaymentScreen.deletePaymentLine called", uuid);
        const res = super.deletePaymentLine(...arguments);
        if (this.currentOrder && typeof this.currentOrder.refreshIGTF === "function") {
            try {
                this.currentOrder.refreshIGTF();
            } catch (e) {
                console.error("Pachacutec: refreshIGTF failed in deletePaymentLine", e);
            }
        }
        return res;
    },
    updateSelectedPaymentline(amount) {
        console.log("[IGTF DEBUG JS] PaymentScreen.updateSelectedPaymentline called with amount:", amount);
        const res = super.updateSelectedPaymentline(...arguments);
        if (this.currentOrder && typeof this.currentOrder.refreshIGTF === "function") {
            try {
                this.currentOrder.refreshIGTF();
            } catch (e) {
                console.error("Pachacutec: refreshIGTF failed in updateSelectedPaymentline", e);
            }
        }
        return res;
    }
});