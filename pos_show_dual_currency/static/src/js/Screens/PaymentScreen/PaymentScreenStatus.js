/** @odoo-module */

import { PaymentScreenStatus } from "@point_of_sale/app/screens/payment_screen/payment_status/payment_status";
import { patch } from "@web/core/utils/patch";
import { usePos } from "@point_of_sale/app/store/pos_hook";

patch(PaymentScreenStatus.prototype, {
    setup() {
        super.setup();
        this.pos = usePos();
    },
    get remainingTextUSD() {
        if (!this.pos) return "";
        const remaining = this.props.order.get_due() > 0 ? (this.props.order.get_due() * this.pos.config.show_currency_rate) : 0;
        return this.pos.format_currency_ref(remaining);
    },
    get changeTextUSD() {
        if (!this.pos) return "";
        const change = this.props.order.get_change() * this.pos.config.show_currency_rate;
        return this.pos.format_currency_ref(change);
    }
});
