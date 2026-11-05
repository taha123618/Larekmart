import { clerkPlugin } from "@clerk/vue";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const publishableKey = config.public.clerkPublishableKey;

  if (publishableKey) {
    nuxtApp.vueApp.use(clerkPlugin, {
      publishableKey,
    });
  }
});
