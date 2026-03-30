/** @odoo-module */

import { ClosePosPopup } from "@point_of_sale/app/navbar/closing_popup/closing_popup";
import { patch } from "@web/core/utils/patch";
import { useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

// Pachacutec: v137 - Estabilización de Assets y Templates Odoo 18
// Elimina AlertDialog (no disponible en assets_pos) y renombra parches.

patch(ClosePosPopup, {
    // Definición de props estáticos (v18)
    props: {
        ...ClosePosPopup.props,
        other_payment_methods: { type: Array, optional: true },
        amount_authorized_diff_ref: { type: Number, optional: true },
    }
});

patch(ClosePosPopup.prototype, {
    setup() {
        super.setup();
        this.dialog = useService("dialog"); // Pachacutec: v136 - Requisito Owl 18
        this.manualInputCashCountUSD = false;
        
        // En v18 'info' se pasa via props
        if (this.props.info) {
             Object.assign(this, this.props.info);
             if (this.props.info.state) {
                 Object.assign(this.state, this.props.info.state);
             }
        }

        // Estado reactivo adicional para dólars
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
                    this.pos.format_currency_ref(this.amountAuthorizedDiffUSD)
                ),
            });
        }
    },

    openDetailsPopupUSD() {
        const ref_id = this.defaultCashDetails.default_cash_details_ref.id;
        this.state.payments_usd[ref_id].counted = 0;
        this.state.payments_usd[ref_id].difference = -this.defaultCashDetails.default_cash_details_ref.amount;
        this.state.displayMoneyDetailsPopupUSD = true;
    },

    closeDetailsPopupUSD() {
        this.state.displayMoneyDetailsPopupUSD = false;
    },

    handleInputChangeUSD(paymentId) {
        let expectedAmount;
        if (paymentId === this.defaultCashDetails.default_cash_details_ref.id) {
            this.manualInputCashCountUSD = true;
            expectedAmount = this.defaultCashDetails.default_cash_details_ref.amount;
        } else {
            expectedAmount = this.otherPaymentMethods.find(pm => paymentId === pm.id).amount;
        }
        this.state.payments_usd[paymentId].difference =
            this.pos.round_decimals_currency(this.state.payments_usd[paymentId].counted - expectedAmount);
    },

    updateCountedCashUSD({ total_ref, moneyDetailsNotesRef }) {
        const ref_id = this.defaultCashDetails.default_cash_details_ref.id;
        this.state.payments_usd[ref_id].counted = total_ref;
        this.state.payments_usd[ref_id].difference =
            this.pos.round_decimals_currency(this.state.payments_usd[ref_id].counted - this.defaultCashDetails.default_cash_details_ref.amount);
        
        if (moneyDetailsNotesRef) {
            this.state.notes += moneyDetailsNotesRef;
        }
        this.manualInputCashCountUSD = false;
        this.closeDetailsPopupUSD();
    },

    hasDifferenceUSD() {
        return Object.entries(this.state.payments_usd || {}).find(pm => pm[1].difference != 0);
    },

    hasUserAuthorityUSD() {
        const absDifferences = Object.entries(this.state.payments_usd || {}).map(pm => Math.abs(pm[1].difference));
        const maxDiff = absDifferences.length ? Math.max(...absDifferences) : 0;
        return this.pos.get_cashier().role === 'manager' || this.amountAuthorizedDiffUSD == null || maxDiff <= this.amountAuthorizedDiffUSD;
    },

    async closeSession() {
        if (!this.closeSessionClicked) {
            this.closeSessionClicked = true;
            if (this.cashControl) {
                const ref_id = this.defaultCashDetails.default_cash_details_ref.id;
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
