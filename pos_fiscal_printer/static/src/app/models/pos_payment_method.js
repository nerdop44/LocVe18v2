/** @odoo-module */

import { PaymentMethod } from "@point_of_sale/app/models/pos_payment_method";
import { patch } from "@web/core/utils/patch";

patch(PaymentMethod.prototype, {
    setup(vals) {
        super.setup(...arguments);
        // Odoo 18: Map custom fields from the server to the JS object
        this.x_printer_code = vals.x_printer_code || "01";
        this.x_igtf_percentage = vals.x_igtf_percentage || 0;
        this.x_is_foreign_exchange = vals.x_is_foreign_exchange || false;
    },
});
