/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosOrder } from "@point_of_sale/app/models/pos_order";

// Pachacutec: v18 - Registro formal del campo en el esquema para evitar errores de getIndexMaps
PosOrder.fields = {
    ...PosOrder.fields,
    salesman_id: { type: "many2one", model: "hr.employee" },
};

patch(PosOrder.prototype, {
    setup(_attr, options) {
        super.setup(...arguments);
    },
    
    init_from_JSON(json) {
        super.init_from_JSON(...arguments);
        if (json.salesman_id) {
            // Buscamos el empleado en los modelos de Odoo 18
            const employees = this.models?.['hr.employee']?.getAll() || [];
            const salesman = employees.find(s => s.id === json.salesman_id);
            if (salesman) {
                this.salesman_id = salesman;
            } else {
                this.salesman_id = null;
            }
        }
    },
    
    export_as_JSON() {
        const json = super.export_as_JSON(...arguments);
        json.salesman_id = (this.salesman_id && typeof this.salesman_id === 'object') ? this.salesman_id.id : (this.salesman_id || false);
        return json;
    },
    
    set_salesman_id(salesman) {
        this.salesman_id = salesman;
    },
    
    get_salesman_id() {
        return this.salesman_id;
    },
    
    get_salesman_name() {
        return this.salesman_id ? this.salesman_id.name : "";
    },
});

