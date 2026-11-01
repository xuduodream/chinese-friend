// Lets the server-side tsc pass typecheck component imports in tests.
// vue-tsc checks the real SFC types through the app tsconfig.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
