package handlers

import (
	"encoding/json"
	"math"
	"net/http"
)

// CohortInput represents a user cohort's activity counts across periods.
type CohortInput struct {
	CohortLabel   string `json:"cohortLabel"`
	InitialUsers  int    `json:"initialUsers"`
	RetainedUsers []int  `json:"retainedUsers"`
}

// CohortRetentionRow holds retention percentages for a cohort.
type CohortRetentionRow struct {
	CohortLabel       string    `json:"cohortLabel"`
	InitialUsers      int       `json:"initialUsers"`
	RetentionPercents []float64 `json:"retentionPercents"`
}

// FunnelStep represents a single step count in a conversion funnel.
type FunnelStep struct {
	Step  string `json:"step"`
	Users int    `json:"users"`
}

// FunnelStepResult includes step conversion and drop-off metrics.
type FunnelStepResult struct {
	Step               string  `json:"step"`
	Users              int     `json:"users"`
	StepConversionRate float64 `json:"stepConversionRate"`
	OverallRate        float64 `json:"overallRate"`
}

// SellerProfitabilityInput contains revenue and cost inputs for a seller.
type SellerProfitabilityInput struct {
	SellerID       string  `json:"sellerId"`
	GrossRevenue   float64 `json:"grossRevenue"`
	CommissionFees float64 `json:"commissionFees"`
	ShippingCosts  float64 `json:"shippingCosts"`
	RefundAmount   float64 `json:"refundAmount"`
}

// SellerProfitabilityResult reports net profit and margin percentage.
type SellerProfitabilityResult struct {
	SellerID         string  `json:"sellerId"`
	GrossRevenue     float64 `json:"grossRevenue"`
	TotalDeductions  float64 `json:"totalDeductions"`
	NetProfit        float64 `json:"netProfit"`
	NetMarginPercent float64 `json:"netMarginPercent"`
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

// ComputeCohortRetention calculates period-over-period retention percentages per cohort.
func ComputeCohortRetention(cohorts []CohortInput) []CohortRetentionRow {
	rows := make([]CohortRetentionRow, 0, len(cohorts))
	for _, c := range cohorts {
		percents := make([]float64, 0, len(c.RetainedUsers))
		for _, retained := range c.RetainedUsers {
			if c.InitialUsers <= 0 {
				percents = append(percents, 0)
			} else {
				percents = append(percents, round2((float64(retained)/float64(c.InitialUsers))*100))
			}
		}
		rows = append(rows, CohortRetentionRow{
			CohortLabel:       c.CohortLabel,
			InitialUsers:      c.InitialUsers,
			RetentionPercents: percents,
		})
	}
	return rows
}

// ComputeFunnelConversion calculates step-by-step and overall conversion rates.
func ComputeFunnelConversion(steps []FunnelStep) []FunnelStepResult {
	if len(steps) == 0 {
		return nil
	}
	topUsers := steps[0].Users
	results := make([]FunnelStepResult, 0, len(steps))
	for i, s := range steps {
		prevUsers := s.Users
		if i > 0 {
			prevUsers = steps[i-1].Users
		}
		stepRate := 100.0
		if i > 0 && prevUsers > 0 {
			stepRate = round2((float64(s.Users) / float64(prevUsers)) * 100)
		} else if i > 0 {
			stepRate = 0
		}
		overallRate := 0.0
		if topUsers > 0 {
			overallRate = round2((float64(s.Users) / float64(topUsers)) * 100)
		}
		results = append(results, FunnelStepResult{
			Step:               s.Step,
			Users:              s.Users,
			StepConversionRate: stepRate,
			OverallRate:        overallRate,
		})
	}
	return results
}

// ComputeSellerProfitability computes net profit and margin after marketplace deductions.
func ComputeSellerProfitability(in SellerProfitabilityInput) SellerProfitabilityResult {
	deductions := in.CommissionFees + in.ShippingCosts + in.RefundAmount
	net := in.GrossRevenue - deductions
	margin := 0.0
	if in.GrossRevenue > 0 {
		margin = round2((net / in.GrossRevenue) * 100)
	}
	return SellerProfitabilityResult{
		SellerID:         in.SellerID,
		GrossRevenue:     round2(in.GrossRevenue),
		TotalDeductions:  round2(deductions),
		NetProfit:        round2(net),
		NetMarginPercent: margin,
	}
}

// InsightsRequest allows dynamic calculation of cohorts, funnels, and seller profitability.
type InsightsRequest struct {
	Cohorts []CohortInput              `json:"cohorts"`
	Funnel  []FunnelStep               `json:"funnel"`
	Sellers []SellerProfitabilityInput `json:"sellers"`
}

// HandleInsightsSummary dynamically computes cohort retention, funnel conversion,
// and seller profitability from the provided JSON payload (POST) or returns empty
// zero-state collections (GET) without hardcoded sample numbers.
func HandleInsightsSummary(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req InsightsRequest
	if r.Method == http.MethodPost && r.Body != nil {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"message": "Invalid JSON insights payload"})
			return
		}
	}

	profitability := make([]SellerProfitabilityResult, 0, len(req.Sellers))
	for _, s := range req.Sellers {
		profitability = append(profitability, ComputeSellerProfitability(s))
	}

	cohorts := ComputeCohortRetention(req.Cohorts)
	funnel := ComputeFunnelConversion(req.Funnel)
	if funnel == nil {
		funnel = []FunnelStepResult{}
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"cohorts":             cohorts,
		"funnel":              funnel,
		"sellerProfitability": profitability,
	})
}
