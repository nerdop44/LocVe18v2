/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { useService } from "@web/core/utils/hooks";

patch(PaymentScreen.prototype, {
    setup() {
        if (super.setup) {
            super.setup();
        }
        try {
            this.pos = useService("pos");
        } catch (e) {
            console.error("Failed to load 'pos' service in PaymentScreen:", e);
        }
    },
    updateSelectedPaymentline(amount = false) {
        if (amount === false && this.selectedPaymentLine && this.selectedPaymentLine.payment_method_id?.x_is_foreign_exchange) {
            let inputVal = 0;
            if (this.numberBuffer.get() === null) {
                inputVal = null;
            } else if (this.numberBuffer.get() === "") {
                inputVal = 0;
            } else {
                inputVal = this.numberBuffer.getFloat();
            }
            
            if (inputVal !== null) {
                const config = this.pos.config;
                const rate = config.show_currency_rate;
                if (rate && rate > 0) {
                    if (rate < 1) {
                        amount = inputVal / rate;
                    } else {
                        amount = inputVal * rate;
                    }
                }
            } else {
                amount = null;
            }
        }
        super.updateSelectedPaymentline(amount);
    },
});
