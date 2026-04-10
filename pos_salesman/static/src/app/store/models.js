/** @odoo-module */

import { patch } from "@web/core/utils/patch";

import { PosStore } from "@point_of_sale/app/store/pos_store";
import { PosOrder } from "@point_of_sale/app/models/pos_order";

import { PosData } from "@point_of_sale/app/models/data_service";

patch(PosStore.prototype, {
    setup() {
        super.setup(...arguments);
        if (this.salesman_ids === undefined) {
            this.salesman_ids = [];
        }
    },
    async processData(loadedData) {
        await super.processData(...arguments);
        
        // Odoo 18: Extract from the standard model collection
        const employeeModel = this.models['hr.employee'];
        if (employeeModel) {
            const allEmployees = typeof employeeModel.getAll === 'function' ? employeeModel.getAll() : (employeeModel.data || []);
            
            // Filter by IDs in config
            const allowedIds = this.config.salesman_ids || [];
            if (allowedIds.length > 0) {
                this.salesman_ids = allEmployees.filter(e => allowedIds.includes(e.id));
            } else {
                this.salesman_ids = allEmployees;
            }
        }
        console.log(">>>>>>>> Salesmen synchronized from hr.employee:", this.salesman_ids.length);
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
            // Find salesman in global list
            this.salesman_id = this.pos.salesman_ids.find(s => s.id === json.salesman_id) || null;
        }
    },
    export_as_JSON() {
        const json = super.export_as_JSON(...arguments);
        json.salesman_id = this.salesman_id ? this.salesman_id.id : false;
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
