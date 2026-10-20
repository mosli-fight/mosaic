import clsx from "clsx";

import { COLOR_PALETTE, STICKY_NOTE_HUES } from "@excalidraw/common";

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

const isTransparent = (color: string | undefined) =>
  !color || color === "transparent";

/** the text of a shape, drawn in the middle of the shape */
const ShapeLabel = ({
  spec,
}: {
  spec: Extract<
    TemplateElementSpec,
    { kind: "rectangle" | "ellipse" | "diamond" }
  >;
}) => {
  if (!spec.label) {
    return null;
  }

  return (
    <text
      x={spec.x + spec.width / 2}
      y={spec.y + spec.height / 2}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={spec.fontSize ?? 16}
      fill={spec.textColor ?? DEFAULT_STROKE}
      fontFamily="inherit"
    >
      {spec.label}
    </text>
  );
};

/** a run of text, drawn as it stands on the board */
const TextRun = ({
  spec,
}: {
  spec: Extract<TemplateElementSpec, { kind: "text" }>;
}) => {
  const lines = spec.text.split("\n");

  return (
    <text
      x={spec.x}
      y={spec.y}
      dominantBaseline="hanging"
      fontSize={spec.fontSize ?? 20}
      fill={spec.color ?? DEFAULT_STROKE}
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

const SpecPreview = ({ spec }: { spec: TemplateElementSpec }) => {
  switch (spec.kind) {
    case "frame":
      return (
        <rect
          x={spec.x}
          y={spec.y}
          width={spec.width}
          height={spec.height}
          fill={isTransparent(spec.fill) ? "none" : spec.fill}
          stroke={FRAME_STROKE}
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
                : spec.backgroundColor
            }
            stroke={spec.strokeColor ?? DEFAULT_STROKE}
            strokeWidth={spec.strokeWidth ?? 1}
            vectorEffect="non-scaling-stroke"
          />
          <ShapeLabel spec={spec} />
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
                : spec.backgroundColor
            }
            stroke={spec.strokeColor ?? DEFAULT_STROKE}
            strokeWidth={spec.strokeWidth ?? 1}
            vectorEffect="non-scaling-stroke"
          />
          <ShapeLabel spec={spec} />
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
                : spec.backgroundColor
            }
            stroke={spec.strokeColor ?? DEFAULT_STROKE}
            strokeWidth={spec.strokeWidth ?? 1}
            vectorEffect="non-scaling-stroke"
          />
          <ShapeLabel spec={spec} />
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
            fill={fill}
            stroke={COLOR_PALETTE.gray[3]}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={spec.x + spec.width / 2}
            y={spec.y + spec.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={spec.fontSize ?? 16}
            fill={DEFAULT_STROKE}
            fontFamily="inherit"
          >
            {spec.text}
          </text>
        </>
      );
    }
    case "text":
      return <TextRun spec={spec} />;
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
            stroke={spec.strokeColor ?? DEFAULT_STROKE}
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
              fill={spec.strokeColor ?? DEFAULT_STROKE}
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
  const bounds = getTemplateBounds(template);

  return (
    <svg
      className={clsx("templates-preview", className)}
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
    >
      {template.elements.map((spec) => (
        <SpecPreview key={spec.id} spec={spec} />
      ))}
    </svg>
  );
};
