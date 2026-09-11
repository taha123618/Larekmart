---
name: email-templates
description: Use when authoring or modifying email content, templates, subjects, or nodemailer transport options in apps/email-service.
---

# Transactional Email Templates & Formatting

Guidance for managing email templates in `apps/email-service`.

## 1. Supported Email Notifications

- **Welcome Email** (`user.created`):
  - Subject: `Welcome to E-commerce App`
  - Body: `Welcome ${username}. Your account has been created!`
- **Order Confirmation Email** (`order.created`):
  - Subject: `Order has been created`
  - Body: `Hello! Your order: Amount: $${amount / 100}, Status: ${status}`

## 2. Formatting Guidelines

- Format amounts from cents to dollars (`amount / 100`).
- Use clean plain-text and HTML fallbacks.
- Sanitize dynamic username inputs before embedding into HTML bodies.
