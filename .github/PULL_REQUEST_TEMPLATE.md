## Description

<!-- Provide a brief summary of the changes introduced by this pull request. -->

## Related Issues

<!-- Link relevant issue numbers, e.g., Closes #123 -->

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to change)
- [ ] 📝 Documentation update
- [ ] ⚡ Performance improvement
- [ ] 🧪 Testing addition or improvement
- [ ] 🔧 Tooling / CI / Infrastructure update

## Affected Workspaces

<!-- Mark workspaces affected by this PR: -->

- [ ] `apps/client` (Storefront)
- [ ] `apps/admin` (Admin Dashboard)
- [ ] `apps/api-gateway`
- [ ] `apps/order-service` / `apps/payment-service` / `apps/product-service`
- [ ] Other backend service(s)
- [ ] `packages/*` (Shared packages)
- [ ] Docker / Kubernetes / DevOps

## Pre-Merge Verification Checklist

<!-- Complete these checks before requesting a review: -->

- [ ] `pnpm check-types` passed with zero errors
- [ ] `pnpm build` succeeded (if modifying Next.js apps or payment-service)
- [ ] `pnpm test` passed for affected test suites
- [ ] `pnpm lint` passed for `client` and `admin`
- [ ] `pnpm format` executed on all modified files
- [ ] Verified architectural boundaries (apps do not import other apps)
- [ ] No secrets, private `.env` files, or test keys committed
- [ ] Updated relevant documentation under `docs/` and `README.md`
