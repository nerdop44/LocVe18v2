/** @odoo-module */

export class DataHelper {
    /**
     * @param {Object} pos - The POS instance
     * @param {Number} pmId - Payment Method ID
     * @returns {String} - 2-character printer code (default "01")
     */
    static getPaymentMethodCode(pos, pmId) {
        if (!pmId) return "01";
        const id = typeof pmId === 'object' ? pmId.id : pmId;

        // 1. Intentar desde el modelo reactivo (Odoo 18 Store)
        const pm = pos.models['pos.payment.method']?.get(id);
        if (pm && pm.x_printer_code) {
            console.log(`[FISCAL] DataHelper - Código hallado en Modelo para PM ${id}: ${pm.x_printer_code}`);
            return pm.x_printer_code.padStart(2, "0");
        }

        // 2. Intentar desde Datos Crudos (Safe Box)
        const rawData = pos.data?.["pos.payment.method"] || [];
        const found = rawData.find(r => r.id === id);
        if (found && found.x_printer_code) {
            console.log(`[FISCAL] DataHelper - Código hallado en Data Cruda para PM ${id}: ${found.x_printer_code}`);
            return found.x_printer_code.padStart(2, "0");
        }

        console.warn(`[FISCAL] DataHelper - No se halló x_printer_code para PM ${id}. Usando 01.`);
        return "01";
    }

    /**
     * @param {Object} pos - The POS instance
     * @param {Object} partner - The Partner object
     * @returns {String} - Sanitized RIF (e.g., V12345678)
     */
    static getFullVat(pos, partner) {
        if (!partner) return "V00000000";
        
        // Pachacutec: v194 - Reconstrucción Blindada
        // Buscamos prefijos (V, J, G, E, P) que Odoo 18 a veces "pierde" en el proxy reactivo
        const vat = (partner.vat || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
        
        // Si ya tiene el prefijo alpha, lo devolvemos tal cual
        if (vat.match(/^[A-Z]\d+$/)) return vat;

        // Si es numérico puro, le inyectamos el prefijo recuperado del modelo o el crudo
        const prefix = partner.prefix_vat || "V";
        console.log(`[FISCAL] DataHelper - Reconstruyendo RIF con prefijo ${prefix}: ${vat}`);
        return `${prefix}${vat}`;
    }
}
