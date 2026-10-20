import {
  loginIcon,
  ExcalLogo,
  eyeIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import { FEATURE_FLAGS } from "@mosaic/brand";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";
import { isExcalidrawPlusSignedUser } from "../app_constants";

import { saveDebugState } from "./DebugCanvas";

/**
 * The three items below (Excalidraw+ upsell, the upstream social links, and
 * sign up / sign in) are all inherited from upstream and none of them are
 * truthful about Mosaic:
 *
 * - Mosaic is not Excalidraw+ and does not resell it.
 * - Mosaic is not the Excalidraw GitHub / X / Discord.
 * - Mosaic has no accounts at all, so "Sign up" points at a service that has
 *   never heard of the user.
 *
 * They are hidden behind `FEATURE_FLAGS` rather than deleted so the code stays
 * exactly where upstream put it (so an upstream sync rarely conflicts here) and
 * can be switched back on with a one-line change. See `packages/mosaic-brand`.
 *
 * `loginIcon` and `ExcalLogo` are still referenced by the JSX below, which stays
 * in the file even though it is not currently rendered - that is deliberate, and
 * it is why no unused-import suppression is needed.
 */
export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  refresh: () => void;
}> = React.memo((props) => {
  const { t } = useI18n();
  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Templates />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      {FEATURE_FLAGS.showExcalidrawPlus && (
        <MainMenu.ItemLink
          icon={ExcalLogo}
          href={`${
            import.meta.env.VITE_APP_PLUS_LP
          }/plus?utm_source=excalidraw&utm_medium=app&utm_content=hamburger`}
          className=""
        >
          Excalidraw+
        </MainMenu.ItemLink>
      )}
      {FEATURE_FLAGS.showUpstreamLinks && <MainMenu.DefaultItems.Socials />}
      {FEATURE_FLAGS.showSignup && (
        <MainMenu.ItemLink
          icon={loginIcon}
          href={`${import.meta.env.VITE_APP_PLUS_APP}${
            isExcalidrawPlusSignedUser ? "" : "/sign-up"
          }?utm_source=signin&utm_medium=app&utm_content=hamburger`}
          className="highlighted"
        >
          {isExcalidrawPlusSignedUser ? t("labels.signIn") : t("labels.signUp")}
        </MainMenu.ItemLink>
      )}
      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onSelect={() => {
            if (window.visualDebug) {
              delete window.visualDebug;
              saveDebugState({ enabled: false });
            } else {
              window.visualDebug = { data: [] };
              saveDebugState({ enabled: true });
            }
            props?.refresh();
          }}
        >
          Visual Debug
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme theme={props.theme} />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
