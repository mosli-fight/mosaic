import clsx from "clsx";

import {
  COLOR_PALETTE,
  STICKY_NOTE_HUES,
  STICKY_NOTE_INK_FOR_BG,
  THEME,
  applyDarkModeFilter,
} from "@excalidraw/common";

import { useUIAppState } from "../../context/ui-appState";
import { getTemplateBounds } from "../../templates/builder";

import type {
  ExcalidrawTemplate,
  TemplateElementSpec,
} from "../../templates/types";

/**
 * The little picture of a template that the gallery shows on its card.
 *
 * The picture is drawn from the template's *specs* rather than from the
 * elements the template builds, so that a gallery full of templates costs
 * nothing to look at: no text is measured and no element is created until a
 * template is actually used.
 */

const FRAME_STROKE = COLOR_PALETTE.gray[3];
const DEFAULT_STROKE = COLOR_PALETTE.black;

/**
 * the space the editor leaves between a shape and its label — the label of a
 * shape is bound to it, and the editor draws it that far in
 */
const LABEL_PADDING = 5;

/** the height of a line of text, as the editor measures it */
const LINE_HEIGHT = 1.25;

const isTransparent = (
  color: string | undefined,
): color is undefined | "transparent" => !color || color === "transparent";

/**
 * A colour, as the board would draw it.
 *
 * The editor darkens and lightens the colours of a scene when it is in dark
 * theme, so a template that was written for a light board still reads on a
 * dark one. The preview has to make the same adjustment, or the picture on
 * the card would not be the picture on the board.
 */
type Ink = (color: string) => string;

/**
 * The text of a shape, drawn where the editor would draw it.
 *
 * The label of a shape is bound to it, so the editor places it according to
 * the shape's alignment — and the preview has to place it the same way, or
 * the picture on the card would not be the picture on the board.
 */
const ShapeLabel = ({
  spec,
  ink,
}: {
  spec: Extract<
    TemplateElementSpec,
    { kind: "rectangle" | "ellipse" | "diamond" }
  >;
  ink: Ink;
}) => {
  if (!spec.label) {
    return null;
  }

  const fontSize = spec.fontSize ?? 16;
  const lines = spec.label.split("\n");
  const textHeight = lines.length * fontSize * LINE_HEIGHT;

  const textAlign = spec.textAlign ?? "center";
  const verticalAlign = spec.verticalAlign ?? "middle";

  const x =
    textAlign === "center"
      ? spec.x + spec.width / 2
      : textAlign === "right"
      ? spec.x + spec.width - LABEL_PADDING
      : spec.x + LABEL_PADDING;

  const y =
    verticalAlign === "top"
      ? spec.y + LABEL_PADDING
      : verticalAlign === "bottom"
      ? spec.y + spec.height - LABEL_PADDING - textHeight
      : spec.y + (spec.height - textHeight) / 2;

  return (
    <text
      x={x}
      y={y}
      textAnchor={
        textAlign === "center"
          ? "middle"
          : textAlign === "right"
          ? "end"
          : "start"
      }
      dominantBaseline="hanging"
      fontSize={fontSize}
      fill={ink(spec.textColor ?? DEFAULT_STROKE)}
      fontFamily="inherit"
    >
      {lines.map((line, index) => (
        <tspan key={index} x={x} dy={index === 0 ? 0 : fontSize * LINE_HEIGHT}>
          {line}
        </tspan>
      ))}
    </text>
  );
};

/** a run of text, drawn as it stands on the board */
const TextRun = ({
  spec,
  ink,
}: {
  spec: Extract<TemplateElementSpec, { kind: "text" }>;
  ink: Ink;
}) => {
  const lines = spec.text.split("\n");

  return (
    <text
      x={spec.x}
      y={spec.y}
      dominantBaseline="hanging"
      fontSize={spec.fontSize ?? 20}
      fill={ink(spec.color ?? DEFAULT_STROKE)}
      fontFamily="inherit"
      fontWeight={spec.bold ? "600" : undefined}
      textAnchor={
        spec.align === "center"
          ? "middle"
          : spec.align === "right"
          ? "end"
          : "start"
      }
    >
      {lines.map((line, index) => (
        <tspan
          key={index}
          x={
            spec.align === "center"
              ? spec.x + spec.width / 2
              : spec.align === "right"
              ? spec.x + spec.width
              : spec.x
          }
          dy={index === 0 ? 0 : (spec.fontSize ?? 20) * 1.25}
        >
          {line}
        </tspan>
      ))}
    </text>
  );
};

const SpecPreview = ({
  spec,
  ink,
}: {
  spec: TemplateElementSpec;
  ink: Ink;
}) => {
  switch (spec.kind) {
    case "frame":
      return (
        <rect
          x={spec.x}
          y={spec.y}
          width={spec.width}
          height={spec.height}
          fill={isTransparent(spec.fill) ? "none" : ink(spec.fill)}
          stroke={ink(FRAME_STROKE)}
          strokeWidth={1}
          strokeDasharray="8 6"
          vectorEffect="non-scaling-stroke"
        />
      );
    case "rectangle":
      return (
        <>
          <rect
            x={spec.x}
            y={spec.y}
            width={spec.width}
            height={spec.height}
            rx={spec.roundness ? 8 : 0}
            fill={
              isTransparent(spec.backgroundColor)
                ? "none"
                : ink(spec.backgroundColor)
            }
            stroke={ink(spec.strokeColor ?? DEFAULT_STROKE)}
            strokeWidth={spec.strokeWidth ?? 1}
            vectorEffect="non-scaling-stroke"
          />
          <ShapeLabel spec={spec} ink={ink} />
        </>
      );
    case "ellipse":
      return (
        <>
          <ellipse
            cx={spec.x + spec.width / 2}
            cy={spec.y + spec.height / 2}
            rx={spec.width / 2}
            ry={spec.height / 2}
            fill={
              isTransparent(spec.backgroundColor)
                ? "none"
                : ink(spec.backgroundColor)
            }
            stroke={ink(spec.strokeColor ?? DEFAULT_STROKE)}
            strokeWidth={spec.strokeWidth ?? 1}
            vectorEffect="non-scaling-stroke"
          />
          <ShapeLabel spec={spec} ink={ink} />
        </>
      );
    case "diamond":
      return (
        <>
          <polygon
            points={`${spec.x + spec.width / 2},${spec.y} ${
              spec.x + spec.width
            },${spec.y + spec.height / 2} ${spec.x + spec.width / 2},${
              spec.y + spec.height
            } ${spec.x},${spec.y + spec.height / 2}`}
            fill={
              isTransparent(spec.backgroundColor)
                ? "none"
                : ink(spec.backgroundColor)
            }
            stroke={ink(spec.strokeColor ?? DEFAULT_STROKE)}
            strokeWidth={spec.strokeWidth ?? 1}
            vectorEffect="non-scaling-stroke"
          />
          <ShapeLabel spec={spec} ink={ink} />
        </>
      );
    case "sticky": {
      const fill = STICKY_NOTE_HUES[spec.hue ?? "yellow"][0];
      return (
        <>
          <rect
            x={spec.x}
            y={spec.y}
            width={spec.width}
            height={spec.height}
            rx={4}
            fill={ink(fill)}
            stroke={ink(COLOR_PALETTE.gray[3])}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={spec.x + spec.width / 2}
            y={spec.y + spec.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={spec.fontSize ?? 16}
            fill={ink(STICKY_NOTE_INK_FOR_BG(fill))}
            fontFamily="inherit"
          >
            {spec.text}
          </text>
        </>
      );
    }
    case "text":
      return <TextRun spec={spec} ink={ink} />;
    case "arrow": {
      const x2 = spec.x + spec.dx;
      const y2 = spec.y + spec.dy;
      return (
        <>
          <line
            x1={spec.x}
            y1={spec.y}
            x2={x2}
            y2={y2}
            stroke={ink(spec.strokeColor ?? DEFAULT_STROKE)}
            strokeWidth={spec.strokeWidth ?? 2}
            strokeDasharray={
              spec.strokeStyle === "dashed"
                ? "8 6"
                : spec.strokeStyle === "dotted"
                ? "2 5"
                : undefined
            }
            vectorEffect="non-scaling-stroke"
          />
          {spec.arrowhead !== false && (
            <polygon
              points={`${x2},${y2} ${x2 - 10},${y2 - 5} ${x2 - 10},${y2 + 5}`}
              fill={ink(spec.strokeColor ?? DEFAULT_STROKE)}
            />
          )}
        </>
      );
    }
  }
};

export const TemplatePreview = ({
  template,
  className,
  label,
}: {
  template: ExcalidrawTemplate;
  className?: string;
  /** what the picture is of, for the screen reader */
  label: string;
}) => {
  const { theme } = useUIAppState();
  const bounds = getTemplateBounds(template);

  // the ink of the board, in the theme the board is in
  const ink: Ink = (color) => applyDarkModeFilter(color, theme === THEME.DARK);

  return (
    <svg
      className={clsx("templates-preview", className)}
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
    >
      {template.elements.map((spec) => (
        <SpecPreview key={spec.id} spec={spec} ink={ink} />
      ))}
    </svg>
  );
};
