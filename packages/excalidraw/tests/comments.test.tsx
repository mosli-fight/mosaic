import { CODES } from "@excalidraw/common";

import { Excalidraw } from "../index";

import {
  addCommentReply,
  addCommentThread,
  removeCommentThread,
  setCommentThreadResolved,
} from "../comments/commentActions";

import { restoreCommentThreads } from "../comments/commentUtils";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { act, fireEvent, render, screen } from "./test-utils";

import type { Collaborator, SocketId } from "../types";

const { h } = window;

const mouse = new Pointer("mouse");

const selectCommentTool = () => {
  act(() => {
    h.app.setActiveTool({ type: "comment" });
  });
};

const openCommentsSidebar = () => {
  act(() => {
    h.app.setState({ openSidebar: { name: "comments" } });
  });
};

/** drops a comment pin at the given viewport coordinates */
const dropPin = (x: number, y: number) => {
  mouse.clickAt(x, y);
};

const typeInComposer = (text: string, testId = "comment-composer-input") => {
  const input = screen.getByTestId(testId);
  fireEvent.change(input, { target: { value: text } });
};

describe("comments", () => {
  beforeAll(() => {
    // radix popovers (and the sidebar island) need a ResizeObserver; jsdom
    // has none
    (global as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("the comment tool", () => {
    it("drops a pin and opens the composer", () => {
      selectCommentTool();

      dropPin(120, 90);

      expect(h.state.commentComposerAnchor).toEqual({
        x: 120,
        y: 90,
        elementId: null,
      });
      expect(screen.getByTestId("comment-composer")).toBeTruthy();
      // nothing is committed yet — the thread only exists once the comment
      // is submitted
      expect(h.state.commentThreads).toHaveLength(0);
    });

    it("stays active after dropping a pin, so several comments can be left", () => {
      selectCommentTool();

      dropPin(120, 90);

      expect(h.state.activeTool.type).toBe("comment");
    });

    it("cancels the composer without creating a thread", () => {
      selectCommentTool();

      dropPin(120, 90);
      fireEvent.click(screen.getByTestId("comment-composer-cancel"));

      expect(h.state.commentComposerAnchor).toBeNull();
      expect(h.state.commentThreads).toHaveLength(0);
    });

    it("anchors the comment to the element under the pointer", () => {
      const rect = API.createElement({
        type: "rectangle",
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        roundness: null,
        backgroundColor: "#ffc9c9",
      });
      act(() => {
        h.app.updateScene({ elements: [rect] });
      });

      selectCommentTool();
      dropPin(80, 80);

      expect(h.state.commentComposerAnchor).toEqual({
        x: 80,
        y: 80,
        elementId: rect.id,
      });
    });
  });

  describe("threads", () => {
    it("creates a thread when the comment is submitted", () => {
      selectCommentTool();
      dropPin(120, 90);

      typeInComposer("Hello there");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      expect(h.state.commentThreads).toHaveLength(1);

      const [thread] = h.state.commentThreads;
      expect(thread.anchor).toEqual({ type: "point", x: 120, y: 90 });
      expect(thread.messages).toHaveLength(1);
      expect(thread.messages[0].text).toBe("Hello there");
      expect(thread.resolved).toBe(false);
      // the new thread is opened right away
      expect(h.state.openCommentThreadId).toBe(thread.id);
      expect(h.state.commentComposerAnchor).toBeNull();
    });

    it("renders a pin for every thread", () => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("First");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      expect(screen.getAllByTestId("comment-pin")).toHaveLength(1);
    });

    it("opens the thread when the pin is clicked", () => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("First");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      // the thread is already open after creation — close it and re-open it
      // through the pin
      fireEvent.click(screen.getByTestId("comment-thread-close"));
      expect(screen.queryByTestId("comment-thread-popover")).toBeNull();

      fireEvent.click(screen.getByTestId("comment-pin"));

      expect(screen.getByTestId("comment-thread-popover")).toBeTruthy();
      expect(screen.getAllByTestId("comment-message")).toHaveLength(1);
      expect(screen.getByText("First")).toBeTruthy();
    });

    it("adds a reply to a thread", () => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("First");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      typeInComposer("Second", "comment-reply-input");
      fireEvent.click(screen.getByTestId("comment-reply-submit"));

      const [thread] = h.state.commentThreads;
      expect(thread.messages).toHaveLength(2);
      expect(thread.messages[1].text).toBe("Second");
      // the pin shows how many replies it has
      expect(screen.getByTestId("comment-pin-badge").textContent).toBe("1");
    });

    it("resolves and unresolves a thread", () => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("First");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      fireEvent.click(screen.getByTestId("comment-resolve-button"));

      expect(h.state.commentThreads[0].resolved).toBe(true);
      // resolved threads are hidden from the canvas by default
      expect(screen.queryByTestId("comment-pin")).toBeNull();

      // ...until the user asks for them
      act(() => {
        h.app.setState({ showResolvedComments: true });
      });
      expect(screen.getAllByTestId("comment-pin")).toHaveLength(1);

      fireEvent.click(screen.getByTestId("comment-resolve-button"));
      expect(h.state.commentThreads[0].resolved).toBe(false);
    });

    it("deletes a thread", () => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("First");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      fireEvent.click(screen.getByTestId("comment-delete-button"));

      expect(h.state.commentThreads).toHaveLength(0);
      expect(screen.queryByTestId("comment-pin")).toBeNull();
      expect(screen.queryByTestId("comment-thread-popover")).toBeNull();
    });

    it("closes the thread when the canvas is clicked", () => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("First");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      expect(screen.getByTestId("comment-thread-popover")).toBeTruthy();

      mouse.clickAt(300, 300);

      expect(h.state.openCommentThreadId).toBeNull();
      expect(screen.queryByTestId("comment-thread-popover")).toBeNull();
    });

    it("is read-only in view mode", () => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("First");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      act(() => {
        h.app.setState({ viewModeEnabled: true });
      });

      expect(screen.getByTestId("comment-thread-popover")).toBeTruthy();
      expect(screen.queryByTestId("comment-reply-input")).toBeNull();
      expect(screen.queryByTestId("comment-resolve-button")).toBeNull();
      expect(screen.queryByTestId("comment-delete-button")).toBeNull();
    });

    it("starts a new comment composer empty after a comment was posted", () => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("First");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      // the thread popover took the composer's place — close it and drop a
      // second pin somewhere else
      fireEvent.click(screen.getByTestId("comment-thread-close"));
      dropPin(300, 240);

      expect(
        (screen.getByTestId("comment-composer-input") as HTMLTextAreaElement)
          .value,
      ).toBe("");
    });

    it("starts a new comment composer empty after the previous one was cancelled", () => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("half-written");
      fireEvent.click(screen.getByTestId("comment-composer-cancel"));

      dropPin(300, 240);

      expect(
        (screen.getByTestId("comment-composer-input") as HTMLTextAreaElement)
          .value,
      ).toBe("");
    });

    it("starts a new comment composer empty when another pin is dropped over an open draft", () => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("half-written");

      // dropping another pin replaces the composer's anchor without going
      // through cancel — the new composer must not inherit the draft
      dropPin(300, 240);

      expect(
        (screen.getByTestId("comment-composer-input") as HTMLTextAreaElement)
          .value,
      ).toBe("");
    });

    it("keeps the draft while the same composer stays open", () => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("still typing");

      // an unrelated app-state change re-renders the layer — the open
      // composer must keep what was typed into it
      act(() => {
        h.app.setState({ showResolvedComments: true });
      });

      expect(
        (screen.getByTestId("comment-composer-input") as HTMLTextAreaElement)
          .value,
      ).toBe("still typing");
    });

    it("starts a reply composer empty for every thread", () => {
      const leaveComment = (text: string, x: number, y: number) => {
        dropPin(x, y);
        typeInComposer(text);
        fireEvent.click(screen.getByTestId("comment-composer-submit"));
        return h.state.commentThreads[h.state.commentThreads.length - 1];
      };

      selectCommentTool();
      const first = leaveComment("First", 120, 90);
      const second = leaveComment("Second", 300, 240);

      // open the first thread and start a reply in it
      fireEvent.click(screen.getByTestId("comment-thread-close"));
      act(() => {
        h.app.setState({ openCommentThreadId: first.id });
      });
      typeInComposer("a reply in progress", "comment-reply-input");

      // switching straight to another thread must not carry the draft over
      act(() => {
        h.app.setState({ openCommentThreadId: second.id });
      });

      expect(
        (screen.getByTestId("comment-reply-input") as HTMLTextAreaElement)
          .value,
      ).toBe("");
    });

    it("does not carry the composer's own popups into a new composer", () => {
      const socketId = "socket-1" as SocketId;
      act(() => {
        h.app.updateScene({
          collaborators: new Map<SocketId, Collaborator>([
            [socketId, { socketId, username: "Ada", isCurrentUser: false }],
          ]),
        });
      });

      selectCommentTool();
      dropPin(120, 90);
      fireEvent.click(screen.getByTestId("comment-emoji-button"));
      typeInComposer("@A");
      expect(screen.getByTestId("comment-emoji-grid")).toBeTruthy();
      expect(screen.getByTestId("comment-mentions")).toBeTruthy();

      // both popups belonged to the previous draft — the new composer must
      // not open with either of them showing
      dropPin(300, 240);

      expect(screen.queryByTestId("comment-emoji-grid")).toBeNull();
      expect(screen.queryByTestId("comment-mentions")).toBeNull();
    });

    it("mentions a collaborator", () => {
      const socketId = "socket-1" as SocketId;
      const collaborators = new Map<SocketId, Collaborator>([
        [
          socketId,
          {
            socketId,
            username: "Ada",
            isCurrentUser: false,
          },
        ],
      ]);
      act(() => {
        h.app.updateScene({ collaborators });
      });

      selectCommentTool();
      dropPin(120, 90);

      typeInComposer("@A");
      expect(screen.getByTestId("comment-mentions")).toBeTruthy();

      fireEvent.click(screen.getByTestId("comment-mention-socket-1"));
      expect(
        (screen.getByTestId("comment-composer-input") as HTMLTextAreaElement)
          .value,
      ).toBe("@Ada ");
    });
  });

  describe("visibility", () => {
    const createThread = (text: string) => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer(text);
      fireEvent.click(screen.getByTestId("comment-composer-submit"));
    };

    it("hides and shows every pin with Shift+C", () => {
      createThread("First");
      expect(screen.getAllByTestId("comment-pin")).toHaveLength(1);

      fireEvent.keyDown(document, {
        key: "C",
        code: CODES.C,
        shiftKey: true,
      });

      expect(h.state.commentsVisible).toBe(false);
      expect(screen.queryByTestId("comment-pin")).toBeNull();

      fireEvent.keyDown(document, {
        key: "C",
        code: CODES.C,
        shiftKey: true,
      });

      expect(h.state.commentsVisible).toBe(true);
      expect(screen.getAllByTestId("comment-pin")).toHaveLength(1);
    });

    it("does not select the comment tool with Shift+C", () => {
      act(() => {
        h.app.setActiveTool({ type: "rectangle" });
      });

      fireEvent.keyDown(document, {
        key: "C",
        code: CODES.C,
        shiftKey: true,
      });

      expect(h.state.activeTool.type).toBe("rectangle");
    });
  });

  describe("the comments panel", () => {
    const createThread = (text: string) => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer(text);
      fireEvent.click(screen.getByTestId("comment-composer-submit"));
    };

    it("lists every thread", () => {
      createThread("First");
      createThread("Second");

      openCommentsSidebar();

      expect(screen.getByTestId("comments-panel")).toBeTruthy();
      expect(screen.getAllByTestId("comments-panel-item")).toHaveLength(2);
      expect(screen.getAllByText("First").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Second").length).toBeGreaterThan(0);
    });

    it("filters the threads by state", () => {
      createThread("First");
      createThread("Second");

      // resolve the second thread
      fireEvent.click(screen.getAllByTestId("comment-pin")[1]);
      fireEvent.click(screen.getByTestId("comment-resolve-button"));
      fireEvent.click(screen.getByTestId("comment-thread-close"));

      openCommentsSidebar();

      expect(screen.getAllByTestId("comments-panel-item")).toHaveLength(1);

      fireEvent.click(screen.getByTestId("comments-filter-resolved"));
      expect(screen.getAllByTestId("comments-panel-item")).toHaveLength(1);
      expect(screen.getByText("Second")).toBeTruthy();

      fireEvent.click(screen.getByTestId("comments-filter-open"));
      expect(screen.getAllByTestId("comments-panel-item")).toHaveLength(1);
      expect(screen.getByText("First")).toBeTruthy();

      fireEvent.click(screen.getByTestId("comments-filter-all"));
      expect(screen.getAllByTestId("comments-panel-item")).toHaveLength(1);
    });

    it("hides the resolved threads until they are asked for", () => {
      createThread("First");
      fireEvent.click(screen.getByTestId("comment-resolve-button"));
      fireEvent.click(screen.getByTestId("comment-thread-close"));

      openCommentsSidebar();
      expect(screen.getByTestId("comments-empty")).toBeTruthy();

      fireEvent.click(screen.getByTestId("comments-toggle-resolved"));
      expect(screen.getAllByTestId("comments-panel-item")).toHaveLength(1);
    });

    it("jumps to the thread when a panel item is clicked", () => {
      createThread("First");
      const [thread] = h.state.commentThreads;

      openCommentsSidebar();
      fireEvent.click(screen.getByTestId("comments-panel-item"));

      expect(h.state.openCommentThreadId).toBe(thread.id);
      expect(screen.getByTestId("comment-thread-popover")).toBeTruthy();
    });

    it("toggles the visibility of every pin", () => {
      createThread("First");

      openCommentsSidebar();
      fireEvent.click(screen.getByTestId("comments-toggle-visibility"));

      expect(h.state.commentsVisible).toBe(false);
      expect(screen.queryByTestId("comment-pin")).toBeNull();
    });
  });

  describe("persistence", () => {
    it("keeps the threads when the app state is restored", () => {
      const [thread] = addCommentThread([], {
        anchor: { type: "point", x: 10, y: 20 },
        author: { id: "u1", name: "Ada", color: "#fff" },
        text: "Hello",
      });

      const restored = restoreCommentThreads([thread]);

      expect(restored).toHaveLength(1);
      expect(restored[0].id).toBe(thread.id);
      expect(restored[0].messages[0].text).toBe("Hello");
      expect(restored[0].anchor).toEqual({ type: "point", x: 10, y: 20 });
    });

    it("drops malformed threads instead of restoring them broken", () => {
      expect(
        restoreCommentThreads([
          null,
          "not a thread",
          { id: "t1" },
          { id: "t2", anchor: { type: "point", x: "a", y: 2 } },
          { id: "t3", anchor: { type: "point", x: 1, y: 2 }, messages: [] },
        ]),
      ).toEqual([]);
    });

    it("does not put the comments in the undo history", async () => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("First");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      expect(h.state.commentThreads).toHaveLength(1);

      // the comment is not undoable — undoing must not touch it
      await act(async () => {
        Keyboard.undo();
      });

      expect(h.state.commentThreads).toHaveLength(1);
    });
  });
});

describe("comment thread mutations", () => {
  const author = { id: "u1", name: "Ada", color: "#fff" };

  it("adds a thread", () => {
    const threads = addCommentThread([], {
      anchor: { type: "point", x: 1, y: 2 },
      author,
      text: "Hello",
    });

    expect(threads).toHaveLength(1);
    expect(threads[0].resolved).toBe(false);
    expect(threads[0].messages).toHaveLength(1);
  });

  it("appends a reply", () => {
    const [thread] = addCommentThread([], {
      anchor: { type: "point", x: 1, y: 2 },
      author,
      text: "Hello",
    });

    const threads = addCommentReply([thread], {
      threadId: thread.id,
      author,
      text: "Hi",
    });

    expect(threads[0].messages).toHaveLength(2);
    expect(threads[0].messages[1].text).toBe("Hi");
  });

  it("resolves and removes a thread", () => {
    const [thread] = addCommentThread([], {
      anchor: { type: "point", x: 1, y: 2 },
      author,
      text: "Hello",
    });

    const resolved = setCommentThreadResolved([thread], {
      threadId: thread.id,
      resolved: true,
    });
    expect(resolved[0].resolved).toBe(true);

    expect(removeCommentThread(resolved, { threadId: thread.id })).toEqual([]);
  });
});
