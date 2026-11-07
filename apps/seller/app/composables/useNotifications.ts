export interface NotificationOptions {
  title: string;
  description?: string;
  color?: "success" | "warning" | "error" | "info" | "primary";
  timeout?: number;
  icon?: string;
}

export function useNotifications() {
  const showToast = (options: NotificationOptions) => {
    // If Nuxt UI useToast is available in runtime
    try {
      const toast = useToast();
      if (toast && typeof toast.add === "function") {
        toast.add({
          title: options.title,
          description: options.description,
          color: options.color === "error" ? "error" : options.color === "warning" ? "warning" : "primary",
          icon: options.icon,
        });
        return;
      }
    } catch {
      // Fallback to console or alert if not hydrated
    }

    if (import.meta.client) {
      console.info(`[Notification - ${options.color || "info"}] ${options.title}: ${options.description || ""}`);
    }
  };

  return {
    success: (title: string, description?: string) =>
      showToast({ title, description, color: "success", icon: "i-heroicons-check-circle" }),
    error: (title: string, description?: string) =>
      showToast({ title, description, color: "error", icon: "i-heroicons-x-circle" }),
    warning: (title: string, description?: string) =>
      showToast({ title, description, color: "warning", icon: "i-heroicons-exclamation-triangle" }),
    info: (title: string, description?: string) =>
      showToast({ title, description, color: "info", icon: "i-heroicons-information-circle" }),
  };
}
