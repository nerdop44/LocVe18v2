/** @odoo-module */

import { patch } from "@web/core/utils/patch";

import { PosStore } from "@point_of_sale/app/store/pos_store";
import { PosOrder } from "@point_of_sale/app/models/pos_order";

import { PosData } from "@point_of_sale/app/models/data_service";

patch(PosData.prototype, {
    async loadInitialData() {
        const response = await super.loadInitialData(...arguments);
        console.log(">>>>>>>> PosData (Salesman): loadInitialData intercepted. Keys:", Object.keys(response || {}));
        
        // Find hr.employee data in the response
        const employees = response['hr.employee']?.data || [];
        
        // Find pos.config to get salesman_ids
        const config = response['pos.config']?.data?.[0] || {};
        const allowedIds = config.salesman_ids || [];
        
        // Store computed salesmen in a way PosStore can find them later
        if (allowedIds.length > 0) {
            this.hr_salesmen = employees.filter(e => allowedIds.includes(e.id));
        } else {
            this.hr_salesmen = employees;
        }
        
        console.log(">>>>>>>> PosData (Salesman): Filtered salesmen count:", this.hr_salesmen.length);
        return response;
    }
});

patch(PosStore.prototype, {
    setup() {
        super.setup(...arguments);
        // Sync the property from PosData service if available
        if (this.data && this.data.hr_salesmen) {
            this.salesman_ids = this.data.hr_salesmen;
        } else {
            this.salesman_ids = [];
        }
    },
    async processData(loadedData) {
        await super.processData(...arguments);
        // Double check after processing
        if (this.data && this.data.hr_salesmen) {
            this.salesman_ids = this.data.hr_salesmen;
            console.log(">>>>>>>> PosStore (Salesman): Synced from PosData:", this.salesman_ids.length);
        }
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
