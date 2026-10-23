/**
 * Editing a code block.
 *
 * A code block is painted on the canvas, but it is *edited* in HTML: the
 * canvas cannot hold a caret, a text selection or a clipboard, so the block
 * grows a small editor over itself while it is being edited — the code in a
 * textarea, the language in a picker beside it. The editor is positioned and
 * scaled exactly over the card, so what is typed appears where it is drawn.
 *
 * The copy button is the other half of the affordance: a code block exists
 * to be copied out of, and a button drawn on a canvas could not be clicked.
 * It is an HTML button over the card's header, shown while the block is
 * selected, and it copies the block's code — not the board.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  CODE_BLOCK_FONT_SIZE,
  CODE_BLOCK_LANGUAGES,
  CODE_BLOCK_LINE_HEIGHT,
  CODE_BLOCK_PADDING,
  getCodeBlockLayout,
} from "@excalidraw/common";
import {
  CODE_BLOCK_FONT_FAMILY,
  CODE_BLOCK_LABEL_FONT_SIZE,
  getCodeBlockColors,
  isCodeBlockElement,
} from "@excalidraw/element";

import {
  useApp,
  useExcalidrawAppState,
  useExcalidrawSetAppState,
} from "../App";
import { IconButton } from "../IconButton";
import { copyIcon } from "../icons";

import { getCodeBlockEditorGeometry } from "./codeBlockEditorGeometry";

import "./CodeBlockEditor.scss";

import type { CodeBlockLanguage } from "@excalidraw/common";
import type { ExcalidrawCodeBlockElement } from "@excalidraw/element/types";

/**
 * The editor over a block that is being edited.
 *
 * The textarea is transparent except for its caret and selection: the code
 * itself is already painted on the canvas underneath, coloured by the
 * tokenizer, and painting it twice would show two slightly different
 * typefaces fighting over the same pixels. The textarea is exactly as wide
 * as the painted code, so a caret typed here lands on the character drawn
 * there.
 */
export const CodeBlockEditor = ({
  element,
}: {
  element: ExcalidrawCodeBlockElement;
}) => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const layout = getCodeBlockLayout(element.code);
  const geometry = getCodeBlockEditorGeometry(element, layout, appState);
  const colors = getCodeBlockColors(appState.theme);

  // the caret goes to the end of the code, where the next keystroke belongs
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

  const updateCode = (code: string) => {
    // the block grows with its code, the way a text element does: the
    // layout is derived again from what was typed, and the card follows it
    const nextLayout = getCodeBlockLayout(code);
    app.scene.mutateElement(element, {
      code,
      width: Math.max(element.width, nextLayout.width),
      height: Math.max(element.height, nextLayout.height),
    });
  };

  return (
    <textarea
      ref={textareaRef}
      className="CodeBlockEditor"
      data-testid="code-block-editor"
      spellCheck={false}
      value={element.code}
      style={{
        left: `${geometry.x}px`,
        top: `${geometry.y}px`,
        width: `${geometry.width}px`,
        height: `${geometry.height}px`,
        padding: `${geometry.paddingTop}px ${CODE_BLOCK_PADDING}px 0 ${CODE_BLOCK_PADDING}px`,
        font: `${CODE_BLOCK_FONT_SIZE}px ${CODE_BLOCK_FONT_FAMILY}`,
        lineHeight: `${CODE_BLOCK_LINE_HEIGHT}`,
        color: "transparent",
        caretColor: colors.text,
        transform: `scale(${appState.zoom.value})`,
        transformOrigin: "top left",
      }}
      onChange={(event) => updateCode(event.target.value)}
      onBlur={() => {
        setAppState({ editingCodeBlock: null });
      }}
      onKeyDown={(event) => {
        // Escape leaves the block; the code is already saved on every
        // keystroke, so there is nothing to commit
        if (event.key === "Escape") {
          event.stopPropagation();
          setAppState({ editingCodeBlock: null });
        }
      }}
    />
  );
};

/**
 * The language picker and the copy button, over a selected block.
 *
 * Both sit in the card's header, where the language label is painted: the
 * picker *is* the label, made changeable, and the copy button sits at the
 * header's far end.
 */
export const CodeBlockToolbar = ({
  element,
}: {
  element: ExcalidrawCodeBlockElement;
}) => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [didCopy, setDidCopy] = useState(false);

  const layout = getCodeBlockLayout(element.code);
  const geometry = getCodeBlockEditorGeometry(element, layout, appState);

  // the "Copied" flash is cleared a moment later, so the button goes back to
  // offering the copy rather than claiming it happened
  useEffect(() => {
    if (!didCopy) {
      return;
    }
    const timer = setTimeout(() => setDidCopy(false), 1500);
    return () => clearTimeout(timer);
  }, [didCopy]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(element.code);
      setDidCopy(true);
    } catch (error: any) {
      setAppState({ toast: { message: "Couldn't copy the code" } });
    }
  };

  const pickLanguage = (language: CodeBlockLanguage) => {
    setIsLanguageOpen(false);
    app.scene.mutateElement(element, { language });
  };

  return (
    <div
      className="CodeBlockToolbar"
      data-testid="code-block-toolbar"
      style={{
        left: `${geometry.x}px`,
        top: `${geometry.y}px`,
        width: `${geometry.width}px`,
        height: `${layout.headerHeight * appState.zoom.value}px`,
        transform: `scale(${appState.zoom.value})`,
        transformOrigin: "top left",
      }}
    >
      <button
        type="button"
        className="CodeBlockToolbar__language"
        data-testid="code-block-language"
        aria-haspopup="listbox"
        aria-expanded={isLanguageOpen}
        style={{ fontSize: `${CODE_BLOCK_LABEL_FONT_SIZE}px` }}
        onClick={() => setIsLanguageOpen((open) => !open)}
      >
        {CODE_BLOCK_LANGUAGES.find((preset) => preset.id === element.language)
          ?.label ?? element.language}
      </button>

      {isLanguageOpen && (
        <ul
          className="CodeBlockToolbar__languages"
          role="listbox"
          data-testid="code-block-languages"
        >
          {CODE_BLOCK_LANGUAGES.map((preset) => (
            <li key={preset.id}>
              <button
                type="button"
                role="option"
                aria-selected={preset.id === element.language}
                className={
                  preset.id === element.language
                    ? "CodeBlockToolbar__language-option CodeBlockToolbar__language-option--selected"
                    : "CodeBlockToolbar__language-option"
                }
                data-testid={`code-block-language-${preset.id}`}
                onClick={() => pickLanguage(preset.id)}
              >
                {preset.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <IconButton
        type="button"
        size="small"
        className="CodeBlockToolbar__copy"
        icon={copyIcon}
        title={didCopy ? "Copied" : "Copy code"}
        aria-label={didCopy ? "Copied" : "Copy code"}
        data-testid="code-block-copy"
        onClick={copy}
      />
    </div>
  );
};

/**
 * The overlay over the block being edited, if it is one.
 *
 * Mounted once, by the app, and renders nothing unless a block is being
 * edited — so a board with no code block never pays for it.
 */
export const CodeBlockEditorOverlay = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const editing = appState.editingCodeBlock
    ? app.scene.getElement(appState.editingCodeBlock)
    : null;

  if (!isCodeBlockElement(editing)) {
    return null;
  }

  return <CodeBlockEditor element={editing} />;
};

/** the toolbar over a selected block, if exactly one is selected */
export const CodeBlockToolbarOverlay = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const selected = app.scene.getSelectedElements(appState);

  if (
    selected.length !== 1 ||
    !isCodeBlockElement(selected[0]) ||
    appState.editingCodeBlock === selected[0].id
  ) {
    return null;
  }

  return <CodeBlockToolbar element={selected[0]} />;
};
