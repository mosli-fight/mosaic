import clsx from "clsx";
import { useState } from "react";

import { KEYS } from "@excalidraw/common";

import { useTunnels } from "../context/tunnels";
import { t } from "../i18n";

import { useEditorInterface, useStylesPanelMode } from "./App";
import { HintViewer } from "./HintViewer";
import { DrawingToolsPopover } from "./DrawingToolsPopover";
import { FrameFormatPicker } from "./frames/FrameFormatPicker";
import { Island } from "./Island";
import { LockButton } from "./LockButton";
import { PenModeButton } from "./PenModeButton";
import Stack from "./Stack";
import { TemplatesButton } from "./templates/TemplatesButton";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import {
  EmbedIcon,
  frameToolIcon,
  ImageIcon,
  bucketFillIcon,
  MagicIcon,
  mermaidLogoIcon,
  DotsIcon,
} from "./icons";
import {
  ArrowToolButton,
  DiamondToolButton,
  EllipseToolButton,
  FreedrawToolPopover,
  HandToolButton,
  isToolButtonDisabled,
  LassoToolButton,
  LineToolButton,
  RectangleToolButton,
  SelectionToolButton,
  SelectionToolPopover,
  StickyNoteToolButton,
  TextToolButton,
  CommentToolButton,
} from "./Tools";

import type {
  AppClassProperties,
  AppProps,
  AppState,
  UIAppState,
} from "../types";

const ExtraToolsDropdown = ({
  app,
  activeTool,
  setAppState,
  UIOptions,
}: {
  app: AppClassProperties;
  activeTool: UIAppState["activeTool"];
  setAppState: React.Component<any, AppState>["setState"];
  UIOptions: AppProps["UIOptions"];
}) => {
  const [isExtraToolsMenuOpen, setIsExtraToolsMenuOpen] = useState(false);
  const { TTDDialogTriggerTunnel } = useTunnels();

  const imageToolSelected = activeTool.type === "image";
  const frameToolSelected = activeTool.type === "frame";
  const bucketFillToolSelected = activeTool.type === "bucketfill";
  const embeddableToolSelected = activeTool.type === "embeddable";

  return (
    <DropdownMenu open={isExtraToolsMenuOpen}>
      <DropdownMenu.Trigger
        className={clsx("App-toolbar__extra-tools-trigger", {
          "App-toolbar__extra-tools-trigger--selected":
            imageToolSelected ||
            frameToolSelected ||
            embeddableToolSelected ||
            bucketFillToolSelected,
        })}
        onToggle={() => {
          setIsExtraToolsMenuOpen(!isExtraToolsMenuOpen);
          setAppState({ openMenu: null, openPopup: null });
        }}
        title={t("toolBar.extraTools")}
      >
        {imageToolSelected
          ? ImageIcon
          : frameToolSelected
          ? frameToolIcon
          : embeddableToolSelected
          ? EmbedIcon
          : bucketFillToolSelected
          ? bucketFillIcon
          : DotsIcon}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        onClickOutside={() => setIsExtraToolsMenuOpen(false)}
        onSelect={() => setIsExtraToolsMenuOpen(false)}
        className="App-toolbar__extra-tools-dropdown"
      >
        {UIOptions.tools?.image !== false && (
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "image" })}
            icon={ImageIcon}
            shortcut={KEYS["9"]}
            data-testid="toolbar-image"
            selected={imageToolSelected}
            disabled={isToolButtonDisabled(app, "image")}
          >
            {t("toolBar.image")}
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Item
          onSelect={() => app.setActiveTool({ type: "frame" })}
          icon={frameToolIcon}
          shortcut={KEYS.F.toLocaleUpperCase()}
          data-testid="toolbar-frame-extra"
          selected={frameToolSelected}
          disabled={isToolButtonDisabled(app, "frame")}
        >
          {t("toolBar.frame")}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={() => app.setActiveTool({ type: "embeddable" })}
          icon={EmbedIcon}
          data-testid="toolbar-embeddable"
          selected={embeddableToolSelected}
          disabled={isToolButtonDisabled(app, "embeddable")}
        >
          {t("toolBar.embeddable")}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={() => app.setActiveTool({ type: "bucketfill" })}
          icon={bucketFillIcon}
          data-testid="toolbar-bucketfill"
          selected={bucketFillToolSelected}
          shortcut={KEYS.B.toLocaleUpperCase()}
          disabled={isToolButtonDisabled(app, "bucketfill")}
        >
          {t("toolBar.bucketfill")}
        </DropdownMenu.Item>
        <div style={{ margin: "6px 0", fontSize: 14, fontWeight: 600 }}>
          Generate
        </div>
        {app.props.aiEnabled !== false && <TTDDialogTriggerTunnel.Out />}
        <DropdownMenu.Item
          onSelect={() => app.setOpenDialog({ name: "ttd", tab: "mermaid" })}
          icon={mermaidLogoIcon}
          data-testid="toolbar-embeddable"
        >
          {t("toolBar.mermaidToExcalidraw")}
        </DropdownMenu.Item>
        {app.props.aiEnabled !== false && app.plugins.diagramToCode && (
          <DropdownMenu.Item
            onSelect={() => app.onMagicframeToolSelect()}
            icon={MagicIcon}
            data-testid="toolbar-magicframe"
            badge={<DropdownMenu.Item.Badge>AI</DropdownMenu.Item.Badge>}
            disabled={isToolButtonDisabled(app, "magicframe")}
          >
            {t("toolBar.magicframe")}
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};

/** the main (desktop/tablet) toolbar island */
export const Toolbar = ({
  app,
  appState,
  setAppState,
  UIOptions,
  onPenModeToggle,
  onLockToggle,
  heading,
}: {
  app: AppClassProperties;
  appState: UIAppState;
  setAppState: React.Component<any, AppState>["setState"];
  UIOptions: AppProps["UIOptions"];
  onPenModeToggle: AppClassProperties["togglePenMode"];
  onLockToggle: () => void;
  heading: React.ReactNode;
}) => {
  const editorInterface = useEditorInterface();
  const isCompactStylesPanel = useStylesPanelMode() === "compact";

  const activeTool = appState.activeTool;
  const toolProps = { app, activeTool };

  return (
    <Island
      padding={1}
      className={clsx("App-toolbar", {
        "zen-mode": appState.zenModeEnabled,
        "App-toolbar--compact": isCompactStylesPanel,
      })}
      data-viewport-ui="top"
    >
      <HintViewer
        appState={appState}
        isMobile={editorInterface.formFactor === "phone"}
        editorInterface={editorInterface}
        app={app}
      />
      {heading}
      <Stack.Row gap={isCompactStylesPanel ? 0.5 : 1}>
        {/* in compact UI the pen mode button is rendered as a separate
            floating button below the compact actions menu */}
        {!isCompactStylesPanel && (
          <PenModeButton
            checked={appState.penMode}
            onChange={() => onPenModeToggle(null)}
            title={t("toolBar.penMode")}
            penDetected={appState.penDetected}
          />
        )}
        {app.props.activeTool == null && (
          <>
            <LockButton
              checked={appState.activeTool.locked}
              onChange={onLockToggle}
              title={t("toolBar.lock")}
              // the active tool — including its lock state — is host-controlled
              disabled={app.props.activeTool != null}
            />

            <div
              className="App-toolbar__divider"
              style={{ marginRight: "0.25rem" }}
            />
          </>
        )}

        <HandToolButton {...toolProps} hideKeyBinding />
        {isCompactStylesPanel ? (
          <SelectionToolPopover {...toolProps} setAppState={setAppState} />
        ) : appState.preferredSelectionTool.type === "lasso" ? (
          <LassoToolButton {...toolProps} />
        ) : (
          <SelectionToolButton {...toolProps} />
        )}
        <RectangleToolButton {...toolProps} />
        <DiamondToolButton {...toolProps} />
        <EllipseToolButton {...toolProps} />
        <ArrowToolButton {...toolProps} />
        <LineToolButton {...toolProps} />
        {isCompactStylesPanel ? (
          <FreedrawToolPopover {...toolProps} />
        ) : (
          <DrawingToolsPopover
            app={app}
            activeTool={activeTool}
            setAppState={setAppState}
          />
        )}
        <TextToolButton {...toolProps} />
        <StickyNoteToolButton {...toolProps} />
        <FrameFormatPicker
          app={app}
          activeTool={activeTool}
          setAppState={setAppState}
        />
        <CommentToolButton {...toolProps} />
        <TemplatesButton app={app} />

        <div
          className="App-toolbar__divider"
          style={{ marginLeft: "0.25rem" }}
        />

        <ExtraToolsDropdown
          app={app}
          activeTool={activeTool}
          setAppState={setAppState}
          UIOptions={UIOptions}
        />
      </Stack.Row>
    </Island>
  );
};
