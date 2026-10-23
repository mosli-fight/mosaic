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

/** a rectangle in the frame's own coordinates */
export type FrameChromeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
};

/**
 * The pieces of chrome a device frame draws, in the frame's own coordinates
 * (the frame's top-left corner is the origin).
 *
 * The layout is pure geometry so that the canvas renderer, the SVG exporter
 * and the tests all agree on where the chrome goes without any of them
 * having to measure anything.
 */
export type FrameChromeLayout = {
  /** the bar across the top of the frame, if the device has one */
  bar: FrameChromeRect | null;
  /** the traffic-light dots of a browser bar */
  dots: readonly { x: number; y: number; radius: number }[];
  /** the address pill of a browser bar */
  pill: FrameChromeRect | null;
  /** the notch of a phone */
  notch: FrameChromeRect | null;
  /** the camera dot of a tablet */
  camera: { x: number; y: number; radius: number } | null;
};

/** the height of a browser's chrome bar, in scene units */
const BROWSER_BAR_HEIGHT = 44;
/** the height of a phone's notch, in scene units */
const PHONE_NOTCH_HEIGHT = 26;
/** the radius of a browser's traffic-light dot */
const BROWSER_DOT_RADIUS = 5;
/** the radius of a tablet's camera dot */
const TABLET_CAMERA_RADIUS = 3;

const EMPTY_CHROME: FrameChromeLayout = {
  bar: null,
  dots: [],
  pill: null,
  notch: null,
  camera: null,
};

/**
 * The chrome a device draws on a frame of the given size.
 *
 * The sizes scale with the frame's width where it matters (a phone notch is
 * a fraction of the screen's width, so it stays a notch at any size), and
 * are clamped so that a frame dragged very small still gets chrome that
 * fits inside it.
 */
export const getFrameChromeLayout = (
  device: FrameDeviceChrome | null | undefined,
  width: number,
  height: number,
): FrameChromeLayout => {
  if (!device || width <= 0 || height <= 0) {
    return EMPTY_CHROME;
  }

  switch (device) {
    case "browser": {
      const barHeight = Math.min(BROWSER_BAR_HEIGHT, height / 3);
      const dotRadius = Math.min(BROWSER_DOT_RADIUS, barHeight / 4);
      const dotY = barHeight / 2;
      const dotGap = dotRadius * 3;
      const firstDotX = Math.min(16, width / 8);
      const pillX = firstDotX + dotGap * 3;
      const pillWidth = Math.max(0, width - pillX - 16);

      return {
        bar: { x: 0, y: 0, width, height: barHeight, radius: 0 },
        dots: [0, 1, 2].map((index) => ({
          x: firstDotX + index * dotGap,
          y: dotY,
          radius: dotRadius,
        })),
        pill:
          pillWidth > 0
            ? {
                x: pillX,
                y: barHeight / 2 - barHeight / 5,
                width: pillWidth,
                height: (barHeight * 2) / 5,
                radius: barHeight / 5,
              }
            : null,
        notch: null,
        camera: null,
      };
    }
    case "phone": {
      const notchWidth = Math.min(width * 0.4, 160);
      const notchHeight = Math.min(PHONE_NOTCH_HEIGHT, height / 8);

      return {
        ...EMPTY_CHROME,
        notch: {
          x: (width - notchWidth) / 2,
          y: 0,
          width: notchWidth,
          height: notchHeight,
          radius: notchHeight / 2,
        },
      };
    }
    case "tablet": {
      const radius = Math.min(TABLET_CAMERA_RADIUS, width / 40);

      return {
        ...EMPTY_CHROME,
        camera: { x: width / 2, y: Math.max(radius * 3, 6), radius },
      };
    }
    case "desktop":
    default:
      return EMPTY_CHROME;
  }
};
