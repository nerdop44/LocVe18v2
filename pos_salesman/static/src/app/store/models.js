/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { PosOrder } from "@point_of_sale/app/models/pos_order";

// v18.0.1.0.52 - DIAGNOSTIC INSTRUMENTATION
// Agregamos logs para inspeccionar la estructura de datos en el cliente.

patch(PosStore.prototype, {
    async processData(loadedData) {
        await super.processData(...arguments);
        
        console.log(">>>>>>>> [pos_salesman] Diagnostic: loadedData keys:", Object.keys(loadedData));
        const employeeResult = loadedData["hr.employee"];
        console.log(">>>>>>>> [pos_salesman] Diagnostic: hr.employee result type:", typeof employeeResult);
        
        if (employeeResult) {
            console.log(">>>>>>>> [pos_salesman] Diagnostic: hr.employee has data:", !!employeeResult.data);
            if (employeeResult.data) {
                console.log(">>>>>>>> [pos_salesman] Diagnostic: hr.employee.data count:", employeeResult.data.length);
            }
        }

        const taxResult = loadedData["account.tax"];
        const taxFields = (taxResult && taxResult.fields) ? taxResult.fields : [];
        console.log(">>>>>>>> [pos_salesman] Diagnostic: Campos de impuestos cargados:", taxFields.join(", "));

        // Cargamos los empleados desde la propiedad .data (estándar RPC v18)
        this.salesman_ids = (employeeResult && employeeResult.data) ? employeeResult.data : (Array.isArray(employeeResult) ? employeeResult : []);
        
        console.log(">>>>>>>> [pos_salesman] Diagnostic Final: salesman_ids count:", this.salesman_ids.length);
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
            if (this.pos && this.pos.salesman_ids) {
                this.salesman_id = this.pos.salesman_ids.find(s => s.id === json.salesman_id) || { id: json.salesman_id, name: "Consultando..." };
            } else {
                this.salesman_id = { id: json.salesman_id, name: "ID: " + json.salesman_id };
            }
        }
    },
    
    export_as_JSON() {
        const json = super.export_as_JSON(...arguments);
        // Mantenemos el blindaje de ID numérico para evitar crashes de validación
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
