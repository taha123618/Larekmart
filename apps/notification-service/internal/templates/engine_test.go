package templates

import (
	"strings"
	"testing"
)

func TestEngine_RenderText(t *testing.T) {
	engine := NewEngine()

	tests := []struct {
		name        string
		templateStr string
		data        interface{}
		wantSub     string
		wantErr     bool
	}{
		{
			name:        "Render welcome message",
			templateStr: "Welcome {{.Username}} to Larekmart!",
			data:        map[string]string{"Username": "Alice"},
			wantSub:     "Welcome Alice to Larekmart!",
			wantErr:     false,
		},
		{
			name:        "Render order amount with custom helper",
			templateStr: "Order total: ${{printf \"%.2f\" .Amount}}",
			data:        map[string]float64{"Amount": 59.90},
			wantSub:     "Order total: $59.90",
			wantErr:     false,
		},
		{
			name:        "Render uppercase helper",
			templateStr: "Status: {{upper .Status}}",
			data:        map[string]string{"Status": "confirmed"},
			wantSub:     "Status: CONFIRMED",
			wantErr:     false,
		},
		{
			name:        "Invalid template syntax",
			templateStr: "Hello {{.Broken",
			data:        map[string]string{},
			wantSub:     "",
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := engine.RenderText(tt.templateStr, tt.data)
			if (err != nil) != tt.wantErr {
				t.Fatalf("RenderText() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && !strings.Contains(got, tt.wantSub) {
				t.Errorf("RenderText() = %q, want substring %q", got, tt.wantSub)
			}
		})
	}
}

func TestEngine_RenderHTML(t *testing.T) {
	engine := NewEngine()

	data := map[string]string{
		"Username": "Bob",
		"Link":     "https://larekmart.com/orders/123",
	}
	tmpl := `<h1>Welcome {{.Username}}</h1><a href="{{.Link}}">View Order</a>`

	out, err := engine.RenderHTML(tmpl, data)
	if err != nil {
		t.Fatalf("RenderHTML() unexpected error: %v", err)
	}

	if !strings.Contains(out, "<h1>Welcome Bob</h1>") {
		t.Errorf("RenderHTML() output %q missing expected header", out)
	}
}
