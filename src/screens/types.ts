// Contract between the router (src/ui/shell.ts) and each top-level screen.

export interface ViewModule {
  /** Called once, the first time the view is shown, with its <section>. */
  mount(section: HTMLElement): void;
  /** Called every time the view is shown; `arg` is the rest of the hash (#/battle/gyms -> "gyms"). */
  show?(arg: string): void;
  /** Called when navigating away. */
  hide?(): void;
}

/** Sub-screens of the Battle tab (#/battle/<id>). */
export interface ModeModule {
  /** Renders the mode's lobby into `container` (called each time the mode is opened). */
  render(container: HTMLElement): void;
  /** Called when leaving the mode's lobby (cleanup listeners). */
  dispose?(): void;
}
