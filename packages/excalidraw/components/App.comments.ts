import type App from "./App";

type ScenePoint = {
  x: number;
  y: number;
};

type PendingComment = {
  point: ScenePoint;
  elementId: string | null;
};

/**
 * Owns the comment tool's interaction with the App.
 *
 * Dropping a pin is deferred to the pointer up, the way bucket fill defers
 * its fill: on pointer down the editor cannot yet know the gesture will
 * stay a single-pointer click (a second finger means pinch/pan, a long
 * press means a context menu).
 */
export class AppComments {
  constructor(private app: App) {}

  private pending: PendingComment | null = null;

  /**
   * Arm a comment at the pointer-down position; nothing is created yet.
   *
   * When the click landed on an element, the comment is anchored to it —
   * the pin still sits at the clicked point, like in Miro.
   */
  handlePointerDown = (scenePointer: ScenePoint) => {
    const element = this.app.getElementAtPosition(
      scenePointer.x,
      scenePointer.y,
    );

    this.pending = {
      point: { x: scenePointer.x, y: scenePointer.y },
      elementId: element?.id ?? null,
    };
  };

  /** Open the composer for the armed comment. */
  handlePointerUp = () => {
    const pending = this.pending;
    this.pending = null;

    if (!pending) {
      return;
    }

    this.app.setState({
      commentComposerAnchor: {
        x: pending.point.x,
        y: pending.point.y,
        elementId: pending.elementId,
      },
      openCommentThreadId: null,
    });
  };

  /** Abort the armed comment (second finger, context menu, pointercancel). */
  cancel = () => {
    this.pending = null;
  };
}
