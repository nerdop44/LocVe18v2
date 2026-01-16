/** @odoo-module */

import { ClosePosPopup } from "@point_of_sale/app/navbar/closing_popup/closing_popup";
import { patch } from "@web/core/utils/patch";
import { useState } from "@odoo/owl";
import { ConfirmationDialog, AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { MoneyDetailsPopupUSD } from "@pos_show_dual_currency/js/Popups/MoneyDetailsPopup";

// Directly extend static props array if it's not already there
if (ClosePosPopup.props && !ClosePosPopup.props.includes("amount_authorized_diff_ref?")) {
    ClosePosPopup.props.push("amount_authorized_diff_ref?");
}

// Ensure other related props from our models.js return are also allowed if needed
["state", "cash_control"].forEach(p => {
    if (ClosePosPopup.props && !ClosePosPopup.props.includes(p) && !ClosePosPopup.props.includes(p + "?")) {
        ClosePosPopup.props.push(p + "?");
    }
});

patch(ClosePosPopup.prototype, {
    setup() {
        super.setup();
        this.manualInputCashCountUSD = false;
        this.state.displayMoneyDetailsPopupUSD = false;
        this.state.payments_usd = this.props.state?.payments_usd || {};
        this.amount_authorized_diff_ref = this.props.amount_authorized_diff_ref;
    },

    async confirm() {
        const hasDifferenceUSD = Object.entries(this.state.payments_usd).find(pm => pm[1].difference != 0);

        if (!this.pos.config.cash_control || !hasDifferenceUSD) {
            return super.confirm();
        }

        if (this.hasUserAuthorityUSD()) {
            const confirmed = await this.env.services.dialog.add(ConfirmationDialog, {
                title: this.env._t("Currency Ref Payments Difference"),
                body: this.env._t("Do you want to accept currency ref payments difference and post a profit/loss journal entry?"),
            });
            if (confirmed) {
                return super.confirm();
            }
        } else {
            this.env.services.dialog.add(AlertDialog, {
                title: this.env._t("Currency Ref Payments Difference"),
                body: _.str.sprintf(
                    this.env._t("The maximum difference by currency ref allowed is %s.\n\
                    Please contact your manager to accept the closing difference."),
                    this.pos.format_currency_ref(this.amount_authorized_diff_ref)
                ),
            });
        }
    },

    openDetailsPopupUSD() {
        const cashMethodRef = this.props.default_cash_details.default_cash_details_ref;
        if (!this.state.payments_usd[cashMethodRef.id]) {
            this.state.payments_usd[cashMethodRef.id] = { counted: 0, difference: -cashMethodRef.amount };
        }
        this.state.displayMoneyDetailsPopupUSD = true;
    },

    closeDetailsPopupUSD() {
        this.state.displayMoneyDetailsPopupUSD = false;
    },

    handleInputChangeUSD(paymentId) {
        let expectedAmount;
        const cashMethodRef = this.props.default_cash_details.default_cash_details_ref;
        if (paymentId === cashMethodRef.id) {
            this.manualInputCashCountUSD = true;
            expectedAmount = cashMethodRef.amount;
        } else {
            // Logic for other non-cash methods if they have USD counterparts
            expectedAmount = 0;
        }
        this.state.payments_usd[paymentId].difference =
            this.pos.round_decimals_currency(this.state.payments_usd[paymentId].counted - expectedAmount);
    },

    updateCountedCashUSD({ total_ref, moneyDetailsNotesRef }) {
        const cashMethodRef = this.props.default_cash_details.default_cash_details_ref;
        this.state.payments_usd[cashMethodRef.id].counted = total_ref;
        this.state.payments_usd[cashMethodRef.id].difference =
            this.pos.round_decimals_currency(total_ref - cashMethodRef.amount);

        if (moneyDetailsNotesRef) {
            this.state.notes += moneyDetailsNotesRef;
        }
        this.manualInputCashCountUSD = false;
        this.closeDetailsPopupUSD();
    },

    hasUserAuthorityUSD() {
        const absDifferences = Object.entries(this.state.payments_usd).map(pm => Math.abs(pm[1].difference));
        const maxDiff = absDifferences.length > 0 ? Math.max(...absDifferences) : 0;
        return this.props.is_manager || this.amount_authorized_diff_ref == null || maxDiff <= this.amount_authorized_diff_ref;
    },

    async closeSession() {
        if (this.pos.config.cash_control) {
            const cashMethodRef = this.props.default_cash_details.default_cash_details_ref;
            const response = await this.pos.data.call(
                "pos.session",
                "post_closing_cash_details_ref",
                [this.pos.session.id],
                {
                    counted_cash: this.state.payments_usd[cashMethodRef.id].counted,
                }
            );
            if (!response.successful) {
                return this.handleClosingError(response);
            }
        }

        await this.pos.data.call(
            "pos.session",
            "update_closing_control_state_session_ref",
            [this.pos.session.id, this.state.notes]
        );

        return super.closeSession();
    }
});

// Patching components (this should work fine with patch utility)
patch(ClosePosPopup, {
    components: {
        ...ClosePosPopup.components,
        MoneyDetailsPopupUSD,
    },
});
