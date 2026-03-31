/** @odoo-module */

import { ClosePosPopup } from "@point_of_sale/app/navbar/closing_popup/closing_popup";
import { FiscalPrinterMixin } from "@pos_fiscal_printer/app/utils/printing_mixin";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { onMounted, useState } from "@odoo/owl";

const patchConfig = {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.pos = useService("pos");
        try {
            this.popup = useService("popup");
        } catch (e) {
            console.warn("Popup service not available in Odoo 18, utilizing dialog service if possible");
            this.dialog = useService("dialog");
        }

        // Ensure state includes zReport. Use Object.assign to respect existing proxy if any.
        // If super didn't init state, we init it.
        // If super init state, we extend it.
        if (!this.state) {
            this.state = useState({ zReport: "" });
        } else {
            // If it's already a reactive object (Proxy), adding a property might trigger reactivity depending on Owl version.
            // Best to use Object.assign.
            Object.assign(this.state, { zReport: "" });
        }

        // Initialize mixin properties
        Object.assign(this, {
            printerCommands: [],
            printing: false,
            read_s2: false,
            read_Z: false,
            writer: false,
            reader: false,
            verificar_desconexion: false,
        });
    },

    // Define accessors manually to link with global POS state
    get port() {
        return this.pos.serialPort;
    },
    set port(serialPort) {
        this.pos.serialPort = serialPort;
    },

    get readerStream() {
        return this.port?.readable?.getReader();
    },

    // Bridge for mixin to use popup service
    showPopup(name, props) {
        return this.popup.add(name, props);
    },

    openDetailsPopup() {
        if (this.state) this.state.zReport = "";
        return super.openDetailsPopup();
    },

    async closeSession() {
        if (!this.state || this.state.zReport === "" || !this.state.zReport) {
            console.log("closeSession sin reporte Z");
        } else {
            console.log("closeSession con reporte Z");
            await this.orm.call("pos.session", "set_z_report", [this.pos.pos_session.id, this.state.zReport]);
        }
        return super.closeSession();
    },

    async printZReport() {
        if (this.pos.config.connection_type === "api") {
            this.printZViaApi();
        } else {
            if (this.printing_lock) {
                console.warn("[FISCAL] Bloqueo de concurrencia activo.");
                return;
            }
            this.printing_lock = true;
            try {
                const result = await this.setPort();
                if (!result) return;
                await this.write_Z();
            } finally {
                if (this.port) {
                    try { await this.port.close(); } catch(e){}
                    this.port = false;
                }
                this.printing_lock = false;
            }
        }
    },

    async printXReport() {
        if (this.pos.config.connection_type === "api") {
            this.printXViaApi();
        } else {
            if (this.printing_lock) {
                console.warn("[FISCAL] Bloqueo de concurrencia activo.");
                return;
            }
            this.printing_lock = true;
            try {
                const result = await this.setPort();
                if (!result) return;
                
                // Mismo flujo de write_Z pero para X
                this.writer = this.port.writable.getWriter();
                this.printerCommands = ["I0X"]; 
                const command = this.printerCommands[0];
                if (this.writer) { await this.writer.releaseLock(); this.writer = false; }
                
                await this.escribe_leer(command, false);
                // No esperamos lectura extendida para Reporte X usualmente
            } finally {
                if (this.port) {
                    try { await this.port.close(); } catch(e){}
                    this.port = false;
                }
                this.printing_lock = false;
            }
        }
    }
};

// Explicitly assign mixin methods.
// Note: We check if they exist to avoid assigning undefined, which might confuse Owl/Props validation.
const mixinMethods = [
    'setPort', 'actionPrint', 'printViaUSB',
    'printViaApi', 'printZViaApi', 'printXViaApi',
    'write', 'write_s2', 'write_Z', 'escribe_leer',
    'setHeader', 'setLines', 'setTotal',
    'printFiscal', 'printNoFiscal',
    // 'showPopup' is NOT in mixin, we implemented it above.
];

for (const method of mixinMethods) {
    if (FiscalPrinterMixin[method]) {
        patchConfig[method] = FiscalPrinterMixin[method];
    } else {
        console.warn(`FiscalPrinterMixin method ${method} not found!`);
    }
}

patch(ClosePosPopup.prototype, patchConfig);
