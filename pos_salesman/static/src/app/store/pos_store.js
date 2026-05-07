/** @odoo-module */
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { patch } from "@web/core/utils/patch";

// v18.0.1.0.62 - Registro incondicional de hr.employee
// Esto permite cargar vendedores aunque la opción nativa de Empleados esté desactivada
patch(PosStore.prototype, {
    async setup() {
        if (!this.models["hr.employee"]) {
            console.log("pos_salesman: Registering hr.employee model in the store...");
            this.models.register("hr.employee");
        }
        return await super.setup(...arguments);
    }
});
