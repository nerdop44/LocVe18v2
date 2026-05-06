/** @odoo-module */

import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";
import { onMounted, onWillUnmount } from "@odoo/owl";

patch(PaymentScreen.prototype, {
    setup() {
        super.setup();

        onMounted(() => {
            if (this.currentOrder) {
                this.currentOrder.removeIGTF();
            }
        });

        onWillUnmount(() => {
            if (this.currentOrder && typeof this.currentOrder.is_paid === 'function' && !this.currentOrder.is_paid()) {
                this.currentOrder.removeIGTF();
            }
        });
    }
});