import { renderInteractiveScene } from "./interactiveScene";

import type { InteractiveSceneRenderConfig } from "../scene/types";

/**
 * Regression for the whole canvas going blank after a sticky tag add or a
 * corner resize. The interactive overlay is chrome painted from React's
 * effect; an exception escaping it unmounted the editor and left a blank
 * canvas behind. It must never take the editor down — a failed overlay frame
 * costs only that frame.
 */
describe("renderInteractiveScene isolation", () => {
  const renderConfig = () =>
    ({
      app: {} as any,
      canvas: null,
      elementsMap: new Map(),
      visibleElements: [],
      selectedElements: [],
      allElementsMap: new Map(),
      scale: 1,
      appState: { zoom: { value: 1 } } as any,
      renderConfig: {
        remoteSelectedElementIds: new Map(),
        remotePointerViewportCoords: new Map(),
        remotePointerUserStates: new Map(),
        remotePointerUsernames: new Map(),
        remotePointerButton: new Map(),
        selectionColor: "#6965db",
        lastViewportPosition: { x: 0, y: 0 },
      },
      editorInterface: {},
      callback: vi.fn(),
      deltaTime: 0,
    } as unknown as InteractiveSceneRenderConfig);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not throw out of the render when the overlay fails", () => {
    const config = renderConfig();
    // a null canvas returns early, so force the failure past that point
    const broken = {
      ...config,
      canvas: document.createElement("canvas"),
      appState: null,
    } as unknown as InteractiveSceneRenderConfig;
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderInteractiveScene(broken)).not.toThrow();
    // the callback still runs, so the editor keeps its scrollbars and
    // image-refresh scheduling
    expect(broken.callback).toHaveBeenCalledTimes(1);
  });

  it("returns the render result on the success path", () => {
    const config = renderConfig();
    const result = renderInteractiveScene(config);

    expect(config.callback).toHaveBeenCalledWith(result);
  });
});
