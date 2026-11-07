import type { ComputedRef, MaybeRef } from 'vue'

type ComponentProps<T> = T extends new(...args: any) => { $props: infer P } ? NonNullable<P>
  : T extends (props: infer P, ...args: any) => any ? P
  : {}

declare module 'nuxt/app' {
  interface NuxtLayouts {
    auth: ComponentProps<typeof import("/Users/taha/projects/microservices-ecommerce/apps/seller/app/layouts/auth.vue").default>,
    default: ComponentProps<typeof import("/Users/taha/projects/microservices-ecommerce/apps/seller/app/layouts/default.vue").default>,
    onboarding: ComponentProps<typeof import("/Users/taha/projects/microservices-ecommerce/apps/seller/app/layouts/onboarding.vue").default>,
}
  export type LayoutKey = keyof NuxtLayouts extends never ? string : keyof NuxtLayouts
  interface PageMeta {
    layout?: MaybeRef<LayoutKey | false> | ComputedRef<LayoutKey | false>
  }
}