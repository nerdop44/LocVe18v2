/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { PosOrder } from "@point_of_sale/app/models/pos_order";

// v18.0.1.0.49 - ESTABILIZACIÓN QUIRÚRGICA
// Eliminamos intercepciones redundantes y aseguramos persistencia de ID.

patch(PosStore.prototype, {
    async processData(loadedData) {
        await super.processData(...arguments);
        
        // Cargamos los vendedores permitidos desde la configuración
        const config = loadedData["pos.config"]?.[0] || {};
        const allowedIds = config.salesman_ids || [];
        const allEmployees = loadedData["hr.employee"] || [];
        
        if (allowedIds.length > 0) {
            this.salesman_ids = allEmployees.filter(e => allowedIds.includes(e.id));
        } else {
            this.salesman_ids = allEmployees;
        }
        
        console.log(">>>>>>>> PosStore (Salesman): Vendedores cargados:", this.salesman_ids.length);
    },
});

patch(PosOrder.prototype, {
    setup(_attr, options) {
        super.setup(...arguments);
        this.salesman_id = this.salesman_id || null;
    },
    
    init_from_JSON(json) {
        super.init_from_JSON(...arguments);
        if (json.salesman_id) {
            // Intentamos recuperar el objeto completo desde la lista global
            if (this.pos && this.pos.salesman_ids) {
                this.salesman_id = this.pos.salesman_ids.find(s => s.id === json.salesman_id) || { id: json.salesman_id, name: "Cargando..." };
            } else {
                this.salesman_id = { id: json.salesman_id, name: "ID: " + json.salesman_id };
            }
        }
    },
    
    export_as_JSON() {
        const json = super.export_as_JSON(...arguments);
        // Enviamos siempre el ID numérico para evitar errores de tipo Many2one en el backend
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
