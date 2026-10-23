/**
 * The device frames: the phone, tablet, desktop and browser canvases the
 * frame tool can make.
 *
 * A device frame is a frame like any other — it holds what is drawn on it,
 * it is presented like a slide, it is listed in the frames panel — with two
 * differences: it is born with the aspect ratio of the device it stands for,
 * and it carries a little chrome (a browser bar, a phone's notch) that says
 * which device it is.
 *
 * The sizes are the logical sizes of the real devices, in scene units: a
 * phone frame holds what a phone screen holds, at the same proportions, so
 * a design laid out in one reads like the design it is meant to be.
 *
 * NOTE: like `frameFormats.ts`, this module imports nothing, so that it can
 * be imported from there without a cycle.
 */

/**
 * The id of a device frame.
 *
 * The ids are prefixed with `device-` so that they never collide with the
 * paper formats of `FRAME_FORMAT_PRESETS` — `tablet` is a paper size and
 * `device-tablet` is a tablet, and a frame format id has to name one of
 * them unambiguously.
 */
export type FrameDeviceId =
  | "device-phone"
  | "device-tablet"
  | "device-desktop"
  | "device-browser";

/**
 * The chrome a device frame draws around its content.
 *
 * `none` is a device frame with no chrome at all — a plain screen at the
 * device's aspect ratio.
 */
export type FrameDeviceChrome = "phone" | "tablet" | "desktop" | "browser";

export type DeviceFramePreset = {
  id: FrameDeviceId;
  /** the size of a frame born with this preset, in scene units */
  width: number;
  height: number;
  /** the chrome drawn on the frame */
  chrome: FrameDeviceChrome;
  /**
   * The height the chrome takes at the top of the frame, in scene units.
   * Content drawn in that band sits under the chrome, so a frame's content
   * should start below it.
   */
  chromeHeight: number;
};

/**
 * The device frames, in the order the picker lists them.
 *
 * The sizes are the logical sizes of the devices they stand for (an iPhone
 * 14, an iPad Air, a laptop screen and a desktop browser window), so the
 * proportions are the ones a designer would work with.
 */
export const DEVICE_FRAME_PRESETS: readonly DeviceFramePreset[] = [
  {
    id: "device-phone",
    width: 390,
    height: 844,
    chrome: "phone",
    chromeHeight: 28,
  },
  {
    id: "device-tablet",
    width: 820,
    height: 1180,
    chrome: "tablet",
    chromeHeight: 0,
  },
  {
    id: "device-desktop",
    width: 1440,
    height: 900,
    chrome: "desktop",
    chromeHeight: 0,
  },
  {
    id: "device-browser",
    width: 1280,
    height: 800,
    chrome: "browser",
    chromeHeight: 44,
  },
];

/** the device frame a format id names, or `null` for a paper format */
export const getDeviceFramePreset = (
  id: string | null | undefined,
): DeviceFramePreset | null => {
  if (!id) {
    return null;
  }
  return DEVICE_FRAME_PRESETS.find((preset) => preset.id === id) ?? null;
};

/** whether the given frame format id names a device frame */
export const isDeviceFrameFormat = (id: string | null | undefined): boolean => {
  return getDeviceFramePreset(id) !== null;
};
