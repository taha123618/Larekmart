package templates

import (
	"bytes"
	"fmt"
	"html/template"
	"strings"
	texttemplate "text/template"
)

type Engine struct{}

func NewEngine() *Engine {
	return &Engine{}
}

// RenderText renders plain text templates (e.g. for SMS, Push notifications, and plain-text Emails).
func (e *Engine) RenderText(templateStr string, data interface{}) (string, error) {
	tmpl, err := texttemplate.New("notif_text").Funcs(texttemplate.FuncMap{
		"upper": strings.ToUpper,
		"lower": strings.ToLower,
	}).Parse(templateStr)
	if err != nil {
		return "", fmt.Errorf("failed to parse text template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute text template: %w", err)
	}

	return buf.String(), nil
}

// RenderHTML renders HTML templates safely (e.g. for rich HTML Emails and In-App views).
func (e *Engine) RenderHTML(templateStr string, data interface{}) (string, error) {
	tmpl, err := template.New("notif_html").Funcs(template.FuncMap{
		"upper": strings.ToUpper,
		"lower": strings.ToLower,
	}).Parse(templateStr)
	if err != nil {
		return "", fmt.Errorf("failed to parse html template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute html template: %w", err)
	}

	return buf.String(), nil
}
