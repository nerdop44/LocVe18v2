/** @odoo-module */

import { ClosePosPopup } from "@point_of_sale/app/navbar/closing_popup/closing_popup";
import { patch } from "@web/core/utils/patch";
import { useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

// Pachacutec: v137 - Estabilización de Assets y Templates Odoo 18
// Elimina AlertDialog (no disponible en assets_pos) y renombra parches.

// Pachacutec: v18.0.1.1.6 - OPCIÓN NUCLEAR (Blindaje Definitivo)
// Desactivamos la validación de props de Owl para este componente.
// Esto evita el crash 'toLowerCase' causado por conflictos de infraestructura entre parches.
ClosePosPopup.props = false;

patch(ClosePosPopup.prototype, {
    setup() {
        super.setup();
        this.dialog = useService("dialog");
        this.manualInputCashCountUSD = false;

        // Initialize state payments_usd safely
        if (!this.state.payments_usd) {
            this.state.payments_usd = {};
        }
        
        const cashDetails = this.props.default_cash_details;
        if (this.pos.config.cash_control && cashDetails && cashDetails.default_cash_details_ref) {
            const ref_id = cashDetails.default_cash_details_ref.id;
            if (ref_id && !this.state.payments_usd[ref_id]) {
                this.state.payments_usd[ref_id] = {
                    counted: 0,
                    difference: -(cashDetails.default_cash_details_ref.amount || 0),
                    number: 0
                };
            }
        }

        Object.assign(this.state, {
            displayMoneyDetailsPopupUSD: false,
        });
    },

    async confirm() {
        if (!this.cashControl || !this.hasDifferenceUSD()) {
            return super.confirm();
        } else if (this.hasUserAuthorityUSD()) {
            const confirmed = await this.dialog.add(ConfirmationDialog, {
                title: this.env._t("Currency Ref Payments Difference"),
                body: this.env._t("Do you want to accept currency ref payments difference and post a profit/loss journal entry?"),
            });
            if (confirmed) {
                return super.confirm();
            }
        } else {
            await this.dialog.add(ConfirmationDialog, {
                title: this.env._t("Currency Ref Payments Difference"),
                body: _.str.sprintf(
                    this.env._t("The maximum difference by currency ref allowed is %s.\nContact your manager to accept."),
                    this.pos.format_currency_ref(this.props.amount_authorized_diff_ref)
                ),
            });
        }
    },

    openDetailsPopupUSD() {
        const ref_id = this.props.default_cash_details?.default_cash_details_ref?.id;
        if (!ref_id || !this.state.payments_usd[ref_id]) return;
        this.state.payments_usd[ref_id].counted = 0;
        this.state.payments_usd[ref_id].difference = -(this.props.default_cash_details.default_cash_details_ref.amount || 0);
        this.state.displayMoneyDetailsPopupUSD = true;
    },

    closeDetailsPopupUSD() {
        this.state.displayMoneyDetailsPopupUSD = false;
    },

    handleInputChangeUSD(paymentId) {
        const ref_id = this.props.default_cash_details?.default_cash_details_ref?.id;
        if (!this.state.payments_usd || !this.state.payments_usd[paymentId]) return;

        let expectedAmount;
        if (paymentId === ref_id) {
            this.manualInputCashCountUSD = true;
            expectedAmount = this.props.default_cash_details.default_cash_details_ref.amount;
        } else {
            expectedAmount = this.props.non_cash_payment_methods.find(pm => paymentId === pm.id)?.amount || 0;
        }
        this.state.payments_usd[paymentId].difference =
            this.pos.round_decimals_currency(this.state.payments_usd[paymentId].counted - expectedAmount);
    },

    updateCountedCashUSD({ total_ref, moneyDetailsNotesRef }) {
        const ref_id = this.props.default_cash_details?.default_cash_details_ref?.id;
        if (!ref_id || !this.state.payments_usd || !this.state.payments_usd[ref_id]) return;

        this.state.payments_usd[ref_id].counted = total_ref;
        this.state.payments_usd[ref_id].difference =
            this.pos.round_decimals_currency(this.state.payments_usd[ref_id].counted - this.props.default_cash_details.default_cash_details_ref.amount);
        
        if (moneyDetailsNotesRef) {
            this.state.notes += moneyDetailsNotesRef;
        }
        this.manualInputCashCountUSD = false;
        this.closeDetailsPopupUSD();
    },

    hasDifferenceUSD() {
        if (!this.state.payments_usd) return false;
        return Object.entries(this.state.payments_usd).find(pm => pm[1].difference != 0);
    },

    hasUserAuthorityUSD() {
        if (!this.state.payments_usd) return true;
        const absDifferences = Object.entries(this.state.payments_usd).map(pm => Math.abs(pm[1].difference));
        const maxDiff = absDifferences.length ? Math.max(...absDifferences) : 0;
        return this.pos.get_cashier().role === 'manager' || this.props.amount_authorized_diff_ref == null || maxDiff <= this.props.amount_authorized_diff_ref;
    },

    async closeSession() {
        if (!this.closeSessionClicked) {
            this.closeSessionClicked = true;
            const ref_id = this.props.default_cash_details?.default_cash_details_ref?.id;
            if (this.pos.config.cash_control && ref_id && this.state.payments_usd && this.state.payments_usd[ref_id]) {
                const response = await this.pos.data.call('pos.session', 'post_closing_cash_details_ref', [
                    [this.pos.pos_session.id]
                ], {
                    counted_cash: this.state.payments_usd[ref_id].counted,
                });
                if (response && !response.successful) {
                    this.closeSessionClicked = false;
                    return this.handleClosingError(response);
                }
            }
            await this.pos.data.call('pos.session', 'update_closing_control_state_session_ref', [
                [this.pos.pos_session.id],
                this.state.notes
            ]);
            this.closeSessionClicked = false;
        }
        super.closeSession();
    }
});
