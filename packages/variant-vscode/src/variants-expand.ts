const VIEW_FOCUS = "variant.variants.focus";

/** Expands the Explorer section on startup, then gives focus back to the editor. Off when the setting is `false`. */
export const expandVariantsView = async (
  enabled: boolean,
  execute: (command: string) => Promise<unknown>,
): Promise<void> => {
  if (!enabled) {
    return;
  }
  await execute(VIEW_FOCUS);
  await execute("workbench.action.focusActiveEditorGroup");
};

/** `variant.autoExpand`: absent means on, only an explicit `false` turns it off. */
export const autoExpandEnabled = (value: unknown): boolean => value !== false;
