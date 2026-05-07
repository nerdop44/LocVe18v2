/** @odoo-module */

import { _t } from "@web/core/l10n/translation";

import { usePos } from "@point_of_sale/app/store/pos_hook";
import { useService } from "@web/core/utils/hooks";
import { Component } from "@odoo/owl";
import { SalesManPos } from "@pos_salesman/app/popups/SalesManPos";

import { registry } from "@web/core/registry";

export class BtnSalesMan extends Component {
    static template = "pos_salesman.BtnSalesMan";
    static props = { "*": true }; // Pachacutec: v137 - Validación OWL 18
    setup() {
        this.pos = usePos();
        this.dialog = useService("dialog");
        this.notification = useService("notification");
    }
    async onClick() {
        const order = this.pos.get_order();
        if (!order) return;

        console.log("BtnSalesMan: accessing this.pos.models['hr.employee']...");
        // Odoo 18: fetch models from the reactive store
        const salesman_list = this.pos.models && this.pos.models['hr.employee'] ? this.pos.models['hr.employee'].getAll() : [];
        console.log("BtnSalesMan: Final salesman_list count:", salesman_list.length);

        if (salesman_list.length === 0) {
            this.notification.add(_t("No hay vendedores configurados para este punto de venta."), {
                title: _t("Sin Vendedores"),
                type: "danger",
            });
            return;
        }

        const salesmen = salesman_list.map(s => ({
            ...s,
            image_url: `/web/image/hr.employee/${s.id}/image_128`
        }));

        this.dialog.add(SalesManPos, {
            title: _t("Seleccionar Vendedor"),
            salesmen: salesmen,
            getPayload: (salesmanId) => {
                order.set_salesman_id(salesmanId);
            },
        });
    }
    get salesmanName() {
        const order = this.pos.get_order();
        return (order && order.salesman_id) ? order.salesman_id.name : "";
    }
}

// Registro en Odoo 18 para pos_control_buttons
export const btnSalesManConfig = {
    component: BtnSalesMan,
};

registry.category("pos_control_buttons").add("BtnSalesMan", btnSalesManConfig);

