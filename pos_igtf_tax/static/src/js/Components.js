/** @odoo-module **/

import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { Orderline } from "@point_of_sale/app/generic_components/orderline/orderline";
import { patch } from "@web/core/utils/patch";
import { onMounted, onWillUnmount } from "@odoo/owl";

patch(PaymentScreen.prototype, {
    setup() {
        super.setup();
        onMounted(() => this.currentOrder.removeIGTF());
        onWillUnmount(() => {
            if (this.currentOrder && !this.currentOrder.finalized) {
                this.currentOrder.removeIGTF();
            }
        });
    }
});

patch(ProductScreen.prototype, {
    async _clickProduct(product) {
        if (product.isIgtfProduct) {
            return this.popup.add(ErrorPopup, {
                title: this.env._t('Acción Inválida'),
                body: this.env._t('No puedes agregar manualmente el producto IGTF'),
            });
        }
        return super._clickProduct(product);
    }
});

// For orderline class injection, it might be better to do it via template or specific props
// But keeping the logic similar to original if possible via patch
patch(Orderline.prototype, {
    getClass() {
        const res = super.getClass();
        if (this.props.line && this.props.line.x_is_igtf_line) {
            return { ...res, "igtf-line": true };
        }
        return res;
    }
});