import { CODES } from "@excalidraw/common";

import { Excalidraw } from "../index";

import {
  addCommentReply,
  addCommentThread,
  attachCommentThread,
  detachCommentThread,
  editCommentMessage,
  toggleCommentReaction,
} from "../comments/commentActions";
import { getMentionCandidates } from "../comments/commentMentions";
import {
  getElementAnchorCenter,
  getThreadAnchorPoint,
  isThreadAttached,
  parseMentions,
  restoreCommentThreads,
  splitTextByMentions,
} from "../comments/commentUtils";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import { act, fireEvent, render, screen, waitFor } from "./test-utils";

import type { Collaborator, SocketId } from "../types";

const { h } = window;

const mouse = new Pointer("mouse");

const selectCommentTool = () => {
  act(() => {
    h.app.setActiveTool({ type: "comment" });
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

/** leaves a comment at the given point and returns its thread */
const leaveComment = (
  text: string,
  at: { x: number; y: number } = { x: 120, y: 90 },
) => {
  selectCommentTool();
  dropPin(at.x, at.y);
  typeInComposer(text);
  fireEvent.click(screen.getByTestId("comment-composer-submit"));
  return h.state.commentThreads[h.state.commentThreads.length - 1];
};

const setCollaborators = (collaborators: [SocketId, Collaborator][]) => {
  act(() => {
    h.app.updateScene({
      collaborators: new Map<SocketId, Collaborator>(collaborators),
    });
  });
};

describe("comments upgrade", () => {
  beforeAll(() => {
    (global as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("object-attached comments", () => {
    const addRectangle = () => {
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
      return rect;
    };

    it("anchors a comment dropped on an element to that element", () => {
      const rect = addRectangle();

      selectCommentTool();
      dropPin(80, 80);
      typeInComposer("On the shape");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      const [thread] = h.state.commentThreads;
      expect(thread.anchor.type).toBe("element");
      expect(thread.anchor.type === "element" && thread.anchor.elementId).toBe(
        rect.id,
      );
      expect(isThreadAttached(thread)).toBe(true);
    });

    it("keeps a comment dropped on empty canvas at a fixed point", () => {
      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("On the canvas");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      const [thread] = h.state.commentThreads;
      expect(thread.anchor).toEqual({ type: "point", x: 120, y: 90 });
      expect(isThreadAttached(thread)).toBe(false);
    });

    it("moves the pin along with the element it is attached to", () => {
      const rect = addRectangle();

      selectCommentTool();
      dropPin(80, 80);
      typeInComposer("On the shape");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      const pin = screen.getByTestId("comment-pin");
      // the pin sits where the comment was dropped
      expect(pin.style.left).toBe("80px");
      expect(pin.style.top).toBe("80px");

      act(() => {
        h.app.updateScene({
          elements: [{ ...rect, x: 200, y: 200 }],
        });
      });

      // the element's centre moved by 150 in both directions, and so did the
      // pin
      expect(screen.getByTestId("comment-pin").style.left).toBe("230px");
      expect(screen.getByTestId("comment-pin").style.top).toBe("230px");
    });

    it("shows that the comment is attached to an element", () => {
      addRectangle();

      selectCommentTool();
      dropPin(80, 80);
      typeInComposer("On the shape");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      expect(screen.getByTestId("comment-pin-attached")).toBeTruthy();
      expect(
        screen.getByTestId("comment-pin").getAttribute("data-attached"),
      ).toBe("true");
    });

    it("lists the attached comment in the panel as attached", () => {
      addRectangle();

      selectCommentTool();
      dropPin(80, 80);
      typeInComposer("On the shape");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      act(() => {
        h.app.setState({ openSidebar: { name: "comments" } });
      });

      expect(screen.getByTestId("comments-panel-attached")).toBeTruthy();
    });

    it("detaches a comment from its element again", () => {
      addRectangle();

      selectCommentTool();
      dropPin(80, 80);
      typeInComposer("On the shape");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      fireEvent.click(screen.getByTestId("comment-attach-button"));

      const [thread] = h.state.commentThreads;
      expect(thread.anchor.type).toBe("point");
      expect(isThreadAttached(thread)).toBe(false);
      expect(screen.queryByTestId("comment-pin-attached")).toBeNull();
    });

    it("attaches a comment dropped on the canvas to the element under it", () => {
      selectCommentTool();
      dropPin(300, 300);
      typeInComposer("Free");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      // the comment was dropped on empty canvas
      expect(h.state.commentThreads[0].anchor.type).toBe("point");

      // a shape is put under the pin afterwards
      const rect = API.createElement({
        type: "rectangle",
        x: 250,
        y: 250,
        width: 100,
        height: 100,
        roundness: null,
        backgroundColor: "#ffc9c9",
      });
      act(() => {
        h.app.updateScene({ elements: [rect] });
      });

      fireEvent.click(screen.getByTestId("comment-attach-button"));

      const [thread] = h.state.commentThreads;
      expect(thread.anchor.type).toBe("element");
      expect(thread.anchor.type === "element" && thread.anchor.elementId).toBe(
        rect.id,
      );
      expect(isThreadAttached(thread)).toBe(true);
    });
  });

  describe("@mentions", () => {
    it("offers the people of the session in the mention picker", () => {
      const socketId = "socket-1" as SocketId;
      setCollaborators([
        [socketId, { socketId, username: "Ada", isCurrentUser: false }],
      ]);

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

    it("stores the mentions of a comment and draws them as tokens", () => {
      const socketId = "socket-1" as SocketId;
      setCollaborators([
        [socketId, { socketId, username: "Ada", isCurrentUser: false }],
      ]);

      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("Hey @Ada, look here");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      const [thread] = h.state.commentThreads;
      expect(thread.messages[0].mentions).toEqual([
        { id: "socket-1", name: "Ada" },
      ]);

      const token = screen.getByTestId("comment-mention-token");
      expect(token.textContent).toBe("@Ada");
      expect(token.className).toContain("comment-mention");
    });

    it("lists the mentioned people in the thread", () => {
      const socketId = "socket-1" as SocketId;
      setCollaborators([
        [socketId, { socketId, username: "Ada", isCurrentUser: false }],
      ]);

      selectCommentTool();
      dropPin(120, 90);
      typeInComposer("Hey @Ada");
      fireEvent.click(screen.getByTestId("comment-composer-submit"));

      expect(screen.getByTestId("comment-thread-mentions")).toBeTruthy();
      expect(screen.getByTestId("comment-thread-mention").textContent).toBe(
        "@Ada",
      );
    });

    it("mentions the people who commented on the board", () => {
      const [thread] = addCommentThread([], {
        anchor: { type: "point", x: 1, y: 2 },
        author: { id: "u1", name: "Grace", color: "#fff" },
        text: "Hello",
      });

      const candidates = getMentionCandidates({
        threads: [thread],
        currentUserId: "u2",
        currentUserName: "Ada",
      });

      expect(candidates).toEqual([{ id: "u1", name: "Grace" }]);
    });

    it("mentions the people who left a note on the board", () => {
      const note = API.createElement({
        type: "stickynote",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      }) as any;
      note.author = "Grace";

      const candidates = getMentionCandidates({
        elements: [note],
        currentUserId: "u2",
        currentUserName: "Ada",
      });

      expect(candidates).toEqual([
        { id: `sticky-note-${note.id}`, name: "Grace" },
      ]);
    });

    it("never offers the current user", () => {
      const candidates = getMentionCandidates({
        members: [{ id: "u1", name: "Ada" }],
        currentUserId: "u1",
        currentUserName: "Ada",
      });

      expect(candidates).toEqual([]);
    });

    it("offers the board members the host app hands over", () => {
      const candidates = getMentionCandidates({
        members: [
          { id: "m1", name: "Ada" },
          { id: "m2", name: "Grace" },
        ],
        currentUserId: "u0",
        currentUserName: "Me",
      });

      expect(candidates.map((candidate) => candidate.name)).toEqual([
        "Ada",
        "Grace",
      ]);
    });
  });

  describe("reactions", () => {
    it("reacts to a comment with an emoji", async () => {
      leaveComment("React to me");

      fireEvent.click(screen.getByTestId("comment-add-reaction"));

      const picker = await screen.findByTestId("comment-reaction-picker");
      expect(picker).toBeTruthy();

      fireEvent.click(screen.getByTestId("comment-reaction-emoji-👍"));

      const [thread] = h.state.commentThreads;
      expect(thread.messages[0].reactions).toEqual([
        { emoji: "👍", authorIds: ["current-user"] },
      ]);

      // the reaction is shown with its count
      expect(screen.getByTestId("comment-reaction-👍").textContent).toContain(
        "1",
      );
    });

    it("takes a reaction back", async () => {
      leaveComment("React to me");

      fireEvent.click(screen.getByTestId("comment-add-reaction"));
      await screen.findByTestId("comment-reaction-picker");
      fireEvent.click(screen.getByTestId("comment-reaction-emoji-👍"));

      fireEvent.click(screen.getByTestId("comment-reaction-👍"));

      const [thread] = h.state.commentThreads;
      expect(thread.messages[0].reactions).toBeUndefined();
      expect(screen.queryByTestId("comment-reaction-👍")).toBeNull();
    });

    it("counts the reactions of everybody", () => {
      const [thread] = addCommentThread([], {
        anchor: { type: "point", x: 1, y: 2 },
        author: { id: "u1", name: "Ada", color: "#fff" },
        text: "Hello",
      });

      const threads = toggleCommentReaction([thread], {
        threadId: thread.id,
        messageId: thread.messages[0].id,
        emoji: "👍",
        authorId: "u2",
      });

      expect(threads[0].messages[0].reactions).toEqual([
        { emoji: "👍", authorIds: ["u2"] },
      ]);

      const withTwo = toggleCommentReaction(threads, {
        threadId: thread.id,
        messageId: thread.messages[0].id,
        emoji: "👍",
        authorId: "u3",
      });

      expect(withTwo[0].messages[0].reactions).toEqual([
        { emoji: "👍", authorIds: ["u2", "u3"] },
      ]);
    });

    it("reacts to a reply as well", async () => {
      leaveComment("First");

      typeInComposer("Second", "comment-reply-input");
      fireEvent.click(screen.getByTestId("comment-reply-submit"));

      const reply = screen.getAllByTestId("comment-message")[1];
      const addButton = reply.querySelector(
        '[data-testid="comment-add-reaction"]',
      ) as HTMLElement;
      fireEvent.click(addButton);

      await screen.findByTestId("comment-reaction-picker");
      fireEvent.click(screen.getByTestId("comment-reaction-emoji-🔥"));

      const [thread] = h.state.commentThreads;
      expect(thread.messages[1].reactions).toEqual([
        { emoji: "🔥", authorIds: ["current-user"] },
      ]);
    });
  });

  describe("editing a comment", () => {
    it("edits the text of your own comment", () => {
      leaveComment("First version");

      fireEvent.click(screen.getByTestId("comment-edit-button"));

      const input = screen.getByTestId(
        "comment-editor-input",
      ) as HTMLTextAreaElement;
      expect(input.value).toBe("First version");

      fireEvent.change(input, { target: { value: "Second version" } });
      fireEvent.click(screen.getByTestId("comment-editor-save"));

      const [thread] = h.state.commentThreads;
      expect(thread.messages[0].text).toBe("Second version");
      expect(thread.messages[0].edited).toBe(true);
      expect(screen.getByTestId("comment-edited-badge")).toBeTruthy();
      expect(screen.getByText("Second version")).toBeTruthy();
    });

    it("leaves the comment alone when the edit is cancelled", () => {
      leaveComment("First version");

      fireEvent.click(screen.getByTestId("comment-edit-button"));

      const input = screen.getByTestId("comment-editor-input");
      fireEvent.change(input, { target: { value: "Second version" } });
      fireEvent.click(screen.getByTestId("comment-editor-cancel"));

      const [thread] = h.state.commentThreads;
      expect(thread.messages[0].text).toBe("First version");
      expect(thread.messages[0].edited).toBeUndefined();
      expect(screen.queryByTestId("comment-editor")).toBeNull();
    });

    it("does not offer the edit button on somebody else's comment", () => {
      const [thread] = addCommentThread([], {
        anchor: { type: "point", x: 120, y: 90 },
        author: { id: "u1", name: "Grace", color: "#fff" },
        text: "Not yours",
      });

      act(() => {
        h.app.setState({
          commentThreads: [thread],
          openCommentThreadId: thread.id,
        });
      });

      expect(screen.queryByTestId("comment-edit-button")).toBeNull();
    });

    it("rewrites a message and marks it as edited", () => {
      const [thread] = addCommentThread([], {
        anchor: { type: "point", x: 1, y: 2 },
        author: { id: "u1", name: "Ada", color: "#fff" },
        text: "Hello",
      });

      const threads = editCommentMessage([thread], {
        threadId: thread.id,
        messageId: thread.messages[0].id,
        text: "Hello there",
        editedAt: 1234,
      });

      expect(threads[0].messages[0].text).toBe("Hello there");
      expect(threads[0].messages[0].edited).toBe(true);
      expect(threads[0].messages[0].editedAt).toBe(1234);
    });
  });

  describe("the pieces the upgrade is built of", () => {
    it("finds the mentions of a text", () => {
      const candidates = [
        { id: "u1", name: "Ada" },
        { id: "u2", name: "Ada Lovelace" },
      ];

      expect(parseMentions("hey @Ada Lovelace!", candidates)).toEqual([
        { id: "u2", name: "Ada Lovelace" },
      ]);
      expect(parseMentions("mail me at ada@example.com", candidates)).toEqual(
        [],
      );
      expect(parseMentions("no mention here", candidates)).toEqual([]);
    });

    it("splits a text into plain text and mentions", () => {
      const segments = splitTextByMentions("hey @Ada!", [
        { id: "u1", name: "Ada" },
      ]);

      expect(segments).toEqual([
        { type: "text", text: "hey " },
        { type: "mention", text: "@Ada", mention: { id: "u1", name: "Ada" } },
        { type: "text", text: "!" },
      ]);
    });

    it("places the pin of an attached thread relative to its element", () => {
      const rect = API.createElement({
        type: "rectangle",
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        roundness: null,
      });

      expect(getElementAnchorCenter(rect)).toEqual({ x: 100, y: 100 });

      const [thread] = addCommentThread([], {
        anchor: {
          type: "element",
          elementId: rect.id,
          offsetX: -20,
          offsetY: -20,
          x: 80,
          y: 80,
        },
        author: { id: "u1", name: "Ada", color: "#fff" },
        text: "Hello",
      });

      expect(getThreadAnchorPoint(thread, rect)).toEqual({ x: 80, y: 80 });
      expect(getThreadAnchorPoint(thread, { ...rect, x: 200, y: 200 })).toEqual(
        { x: 230, y: 230 },
      );
      // without the element the pin stays where it was dropped
      expect(getThreadAnchorPoint(thread, null)).toEqual({ x: 80, y: 80 });
    });

    it("attaches and detaches a thread", () => {
      const [thread] = addCommentThread([], {
        anchor: { type: "point", x: 10, y: 20 },
        author: { id: "u1", name: "Ada", color: "#fff" },
        text: "Hello",
      });

      const attached = attachCommentThread([thread], {
        threadId: thread.id,
        elementId: "el-1",
        offsetX: 5,
        offsetY: 6,
      });

      expect(attached[0].anchor).toEqual({
        type: "element",
        elementId: "el-1",
        offsetX: 5,
        offsetY: 6,
        x: 10,
        y: 20,
      });
      expect(isThreadAttached(attached[0])).toBe(true);

      const detached = detachCommentThread(attached, { threadId: thread.id });
      expect(detached[0].anchor).toEqual({ type: "point", x: 10, y: 20 });
      expect(isThreadAttached(detached[0])).toBe(false);
    });

    it("keeps the mentions and the reactions of a restored comment", () => {
      const [thread] = addCommentThread([], {
        anchor: { type: "point", x: 1, y: 2 },
        author: { id: "u1", name: "Ada", color: "#fff" },
        text: "Hello @Grace",
        mentions: [{ id: "u2", name: "Grace" }],
      });

      const withReaction = toggleCommentReaction([thread], {
        threadId: thread.id,
        messageId: thread.messages[0].id,
        emoji: "👍",
        authorId: "u2",
      });

      const restored = restoreCommentThreads(withReaction);

      expect(restored[0].messages[0].mentions).toEqual([
        { id: "u2", name: "Grace" },
      ]);
      expect(restored[0].messages[0].reactions).toEqual([
        { emoji: "👍", authorIds: ["u2"] },
      ]);
    });

    it("keeps the offset of an attached comment when it is restored", () => {
      const restored = restoreCommentThreads([
        {
          id: "t1",
          anchor: {
            type: "element",
            elementId: "el-1",
            offsetX: 5,
            offsetY: 6,
            x: 10,
            y: 20,
          },
          messages: [
            {
              id: "m1",
              author: { id: "u1", name: "Ada" },
              text: "Hello",
              createdAt: 1,
            },
          ],
          resolved: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ]);

      expect(restored[0].anchor).toEqual({
        type: "element",
        elementId: "el-1",
        offsetX: 5,
        offsetY: 6,
        x: 10,
        y: 20,
      });
    });

    it("keeps a reply working", () => {
      const [thread] = addCommentThread([], {
        anchor: { type: "point", x: 1, y: 2 },
        author: { id: "u1", name: "Ada", color: "#fff" },
        text: "Hello",
      });

      const threads = addCommentReply([thread], {
        threadId: thread.id,
        author: { id: "u1", name: "Ada", color: "#fff" },
        text: "Hi",
        mentions: [{ id: "u2", name: "Grace" }],
      });

      expect(threads[0].messages).toHaveLength(2);
      expect(threads[0].messages[1].mentions).toEqual([
        { id: "u2", name: "Grace" },
      ]);
    });
  });

  describe("what the upgrade must not break", () => {
    it("keeps the keyboard shortcut of the comments", () => {
      leaveComment("First");

      expect(screen.getAllByTestId("comment-pin")).toHaveLength(1);

      fireEvent.keyDown(document, {
        key: "C",
        code: CODES.C,
        shiftKey: true,
      });

      expect(h.state.commentsVisible).toBe(false);
      expect(screen.queryByTestId("comment-pin")).toBeNull();
    });

    it("keeps resolving and reopening a thread", () => {
      leaveComment("First");

      fireEvent.click(screen.getByTestId("comment-resolve-button"));
      expect(h.state.commentThreads[0].resolved).toBe(true);

      fireEvent.click(screen.getByTestId("comment-resolve-button"));
      expect(h.state.commentThreads[0].resolved).toBe(false);
    });

    it("keeps the panel listing the threads", async () => {
      leaveComment("First");

      act(() => {
        h.app.setState({ openSidebar: { name: "comments" } });
      });

      await waitFor(() => {
        expect(screen.getByTestId("comments-panel")).toBeTruthy();
      });
      expect(screen.getAllByTestId("comments-panel-item")).toHaveLength(1);
    });
  });
});
