/** Explorer tree opened on startup. `reveal(undefined)` opens the section root. */
export interface SectionTree {
  reveal(element: undefined, options: { select: boolean; focus: boolean }): Thenable<void>;
}

/** Expands the Explorer section on startup without focusing it. Off when the setting is `false`. */
export const expandVariantsView = async (enabled: boolean, tree: SectionTree): Promise<void> => {
  if (!enabled) {
    return;
  }
  await tree.reveal(undefined, { select: false, focus: false });
};

/** `variant.autoExpand`: absent means on, only an explicit `false` turns it off. */
export const autoExpandEnabled = (value: unknown): boolean => value !== false;
