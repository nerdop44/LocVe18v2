/** @odoo-module */

import { OpeningControlPopup } from "@point_of_sale/app/store/opening_control_popup/opening_control_popup";
import { patch } from "@web/core/utils/patch";
import { useState } from "@odoo/owl";
import { MoneyDetailsPopupUSD } from "./money_details_popup_usd";
import { parseFloat } from "@web/views/fields/parsers";

OpeningControlPopup.props = false;
OpeningControlPopup.components = { ...OpeningControlPopup.components, MoneyDetailsPopupUSD };

patch(OpeningControlPopup.prototype, {
    setup() {
        super.setup();
        this.manualInputCashCountUSD = false;
        
        Object.assign(this.state, {
            openingCashUSD: this.env.utils.formatCurrency(
                this.pos.session.cash_register_balance_start_mn_ref || 0,
                false
            ),
            displayMoneyDetailsPopupUSD: false,
        });
    },

    async confirm() {
        // Guardamos el balance de apertura USD en la sesión del POS del cliente
        this.pos.session.cash_register_balance_start_mn_ref = parseFloat(this.state.openingCashUSD);
        
        // Llamamos al backend para persistir set_cashbox_pos_usd
        try {
            await this.pos.data.call(
                "pos.session",
                "set_cashbox_pos_usd",
                [this.pos.session.id, parseFloat(this.state.openingCashUSD), this.state.notes],
                {}
            );
        } catch (error) {
            console.error("Error setting USD opening cash control:", error);
        }
        
        // Ejecutamos el confirm estándar que llamará a set_opening_control para Bs y cerrará el popup
        return super.confirm();
    },

    openDetailsPopupUSD() {
        this.state.openingCashUSD = this.env.utils.formatCurrency(0, false);
        this.state.displayMoneyDetailsPopupUSD = true;
    },

    closeDetailsPopupUSD() {
        this.state.displayMoneyDetailsPopupUSD = false;
    },

    updateCashOpeningUSD({ total_ref, moneyDetailsNotesRef }) {
        this.state.openingCashUSD = this.env.utils.formatCurrency(total_ref, false);
        if (moneyDetailsNotesRef) {
            this.state.notes += "\n" + moneyDetailsNotesRef;
        }
        this.manualInputCashCountUSD = false;
        this.closeDetailsPopupUSD();
    },

    handleInputChangeUSD() {
        if (!this.env.utils.isValidFloat(this.state.openingCashUSD)) {
            return;
        }
        this.manualInputCashCountUSD = true;
    }
});
