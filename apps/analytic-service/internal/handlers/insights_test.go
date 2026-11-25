package handlers

import (
	"testing"
)

func TestCohortRetentionFunnelAndProfitability(t *testing.T) {
	cohorts := ComputeCohortRetention([]CohortInput{
		{CohortLabel: "2026-10", InitialUsers: 200, RetainedUsers: []int{200, 100, 50}},
	})
	if len(cohorts) != 1 || cohorts[0].RetentionPercents[1] != 50.0 || cohorts[0].RetentionPercents[2] != 25.0 {
		t.Fatalf("unexpected cohort retention: %+v", cohorts)
	}

	funnel := ComputeFunnelConversion([]FunnelStep{
		{Step: "VIEW_PRODUCT", Users: 1000},
		{Step: "ADD_TO_CART", Users: 250},
		{Step: "PURCHASE", Users: 50},
	})
	if funnel[1].StepConversionRate != 25.0 || funnel[2].OverallRate != 5.0 {
		t.Fatalf("unexpected funnel conversion: %+v", funnel)
	}

	profit := ComputeSellerProfitability(SellerProfitabilityInput{
		SellerID:       "sel_1",
		GrossRevenue:   1000,
		CommissionFees: 120,
		ShippingCosts:  80,
		RefundAmount:   50,
	})
	if profit.NetProfit != 750 || profit.NetMarginPercent != 75.0 {
		t.Fatalf("unexpected profitability result: %+v", profit)
	}
}
