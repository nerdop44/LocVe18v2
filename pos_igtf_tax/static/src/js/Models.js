/** @odoo-module **/

import { Orderline, Order, Product, Payment } from "@point_of_sale/app/store/models";
import { patch } from "@web/core/utils/patch";
import { parseFloat } from "@web/views/fields/formatters_helpers";

patch(Product.prototype, {
    get isIgtfProduct() {
        const x_igtf_product_id = this.pos.config.x_igtf_product_id;
        return (x_igtf_product_id)
            ? x_igtf_product_id[0] === this.id
            : false;
    }
});

patch(Payment.prototype, {
    get isForeignExchange() {
        return this.payment_method.x_is_foreign_exchange;
    },

    set_amount(value) {
        var igtf_antes = this.order.x_igtf_amount;

        if (value == this.order.get_due()) {
            super.set_amount(value);
        } else {
            if (value != igtf_antes) {
                if (this.isForeignExchange) {
                    super.set_amount(value * (1 / this.pos.config.show_currency_rate));
                } else {
                    super.set_amount(value);
                }
            }
        }

        const igtfProductData = this.pos.config.x_igtf_product_id;
        if (!igtfProductData || !this.isForeignExchange) return;

        if (value == igtf_antes) return;
        this.order.removeIGTF();

        const price = this.order.x_igtf_amount;
        const igtfProduct = this.pos.db.get_product_by_id(igtfProductData[0]);

        if (igtfProduct) {
            this.order.add_product(igtfProduct, {
                quantity: 1,
                price,
                lst_price: price,
            });
        }
    }
});

patch(Orderline.prototype, {
    setup(json) {
        super.setup(...arguments);
        this.x_is_igtf_line = this.x_is_igtf_line || false;
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

patch(Order.prototype, {
    get x_igtf_amount() {
        var igtf_monto = this.paymentlines
            .filter((p) => p.isForeignExchange)
            .map(({ amount, payment_method: { x_igtf_percentage } }) => amount * (x_igtf_percentage / 100))
            .reduce((prev, current) => prev + current, 0);

        var total = this.orderlines.filter((p) => !p.x_is_igtf_line).map((p) => p.get_price_with_tax()).reduce((prev, current) => prev + current, 0);
        var max_igtf = total * 0.03;

        if (igtf_monto > max_igtf) {
            igtf_monto = max_igtf;
        }

        return this.pos.currency.round(parseFloat(igtf_monto) || 0);
    },

    removeIGTF() {
        this.orderlines
            .filter(({ x_is_igtf_line }) => x_is_igtf_line)
            .forEach((line) => this.remove_orderline(line));
    },

    set_orderline_options(orderline, options) {
        super.set_orderline_options(orderline, options);
        orderline.x_is_igtf_line = orderline.product.isIgtfProduct;
    }
});