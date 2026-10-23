import {
  DEVICE_FRAME_PRESETS,
  getDeviceFramePreset,
  getFrameChromeLayout,
  isDeviceFrameFormat,
} from "../src/deviceFrames";

describe("the device-frame presets", () => {
  it("offers a phone, a tablet, a desktop and a browser", () => {
    expect(DEVICE_FRAME_PRESETS.map((preset) => preset.id)).toEqual([
      "device-phone",
      "device-tablet",
      "device-desktop",
      "device-browser",
    ]);
  });

  it("gives each preset its device's proportions", () => {
    for (const preset of DEVICE_FRAME_PRESETS) {
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
    }

    const phone = getDeviceFramePreset("device-phone")!;
    // a phone is tall
    expect(phone.height).toBeGreaterThan(phone.width);

    const desktop = getDeviceFramePreset("device-desktop")!;
    // a desktop screen is wide
    expect(desktop.width).toBeGreaterThan(desktop.height);
  });

  it("draws chrome only where the device has it", () => {
    expect(getDeviceFramePreset("device-browser")!.chrome).toBe("browser");
    expect(getDeviceFramePreset("device-phone")!.chrome).toBe("phone");
    expect(getDeviceFramePreset("device-tablet")!.chrome).toBe("tablet");
    expect(getDeviceFramePreset("device-desktop")!.chrome).toBe("desktop");
  });

  it("never collides with a paper format id", () => {
    for (const preset of DEVICE_FRAME_PRESETS) {
      expect(preset.id.startsWith("device-")).toBe(true);
      expect(isDeviceFrameFormat(preset.id)).toBe(true);
    }

    // the paper formats the picker already offers are not devices
    for (const id of ["custom", "16:9", "4:3", "1:1", "a4", "letter"]) {
      expect(isDeviceFrameFormat(id)).toBe(false);
      expect(getDeviceFramePreset(id)).toBe(null);
    }
  });

  it("resolves a preset by id, and null for anything else", () => {
    expect(getDeviceFramePreset("device-browser")!.width).toBe(1280);
    expect(getDeviceFramePreset(null)).toBe(null);
    expect(getDeviceFramePreset(undefined)).toBe(null);
    expect(getDeviceFramePreset("nope")).toBe(null);
  });
});

describe("the device chrome", () => {
  const browser = getDeviceFramePreset("device-browser")!;
  const phone = getDeviceFramePreset("device-phone")!;

  it("gives a browser a bar, three dots and an address pill", () => {
    const chrome = getFrameChromeLayout(
      "browser",
      browser.width,
      browser.height,
    );

    expect(chrome.bar).not.toBe(null);
    expect(chrome.bar!.width).toBe(browser.width);
    expect(chrome.dots).toHaveLength(3);
    expect(chrome.pill).not.toBe(null);
    expect(chrome.notch).toBe(null);
  });

  it("gives a phone a notch and nothing else", () => {
    const chrome = getFrameChromeLayout("phone", phone.width, phone.height);

    expect(chrome.notch).not.toBe(null);
    // the notch is centred on the phone's screen
    expect(chrome.notch!.x + chrome.notch!.width / 2).toBeCloseTo(
      phone.width / 2,
      5,
    );
    expect(chrome.bar).toBe(null);
    expect(chrome.dots).toHaveLength(0);
  });

  it("gives a tablet a camera dot", () => {
    const chrome = getFrameChromeLayout("tablet", 820, 1180);
    expect(chrome.camera).not.toBe(null);
    expect(chrome.camera!.x).toBeCloseTo(410, 5);
  });

  it("gives a desktop no chrome at all", () => {
    const chrome = getFrameChromeLayout("desktop", 1440, 900);
    expect(chrome).toEqual({
      bar: null,
      dots: [],
      pill: null,
      notch: null,
      camera: null,
    });
  });

  it("gives no chrome to a frame with no device", () => {
    expect(getFrameChromeLayout(null, 800, 600).bar).toBe(null);
    expect(getFrameChromeLayout(undefined, 800, 600).notch).toBe(null);
  });

  it("keeps the chrome inside a frame dragged very small", () => {
    const chrome = getFrameChromeLayout("browser", 40, 30);

    expect(chrome.bar!.height).toBeLessThanOrEqual(30);
    for (const dot of chrome.dots) {
      expect(dot.x).toBeLessThanOrEqual(40);
      expect(dot.radius).toBeGreaterThanOrEqual(0);
    }
  });

  it("scales the notch with the phone's width", () => {
    const wide = getFrameChromeLayout("phone", 800, 1600);
    const narrow = getFrameChromeLayout("phone", 200, 400);

    expect(narrow.notch!.width).toBeLessThan(wide.notch!.width);
    // but never wider than the phone
    expect(wide.notch!.width).toBeLessThanOrEqual(800);
  });

  it("draws nothing on a frame with no size", () => {
    expect(getFrameChromeLayout("browser", 0, 0).bar).toBe(null);
    expect(getFrameChromeLayout("phone", 0, 100).notch).toBe(null);
  });
});
