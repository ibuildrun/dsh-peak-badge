/**
 * Host half of dsh-peak-badge. The feature is browser-side only, so this
 * module deliberately provides no services: it exists so the bundle has a
 * valid host row and is otherwise inert.
 */
const plugin = {
  name: 'dsh-peak-badge',
  apply() {},
}
export default plugin
export const inject = []
