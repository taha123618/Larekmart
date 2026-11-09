import { gsap } from "gsap";

declare module "nuxt/app" {
  interface NuxtApp {
    $gsap: typeof gsap;
  }
}

declare module "vue" {
  interface ComponentCustomProperties {
    $gsap: typeof gsap;
  }
}

export default defineNuxtPlugin(() => {
  return {
    provide: {
      gsap,
    },
  };
});
