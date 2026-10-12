import type { Metadata } from "next";
import { MaintenanceContent } from "./_components/maintenance-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Under Maintenance — Larekmart",
  description:
    "Our marketplace is currently undergoing scheduled maintenance. We will be back online shortly.",
  robots: "noindex, nofollow", // Prevent indexing during maintenance
};

export default function MaintenancePage() {
  const defaultMessage =
    "We are currently performing scheduled maintenance to improve your marketplace shopping experience. We will be back online shortly.";

  return (
    <MaintenanceContent message={defaultMessage} estimatedCompletion={null} />
  );
}
