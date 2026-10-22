import { COLOR_PALETTE } from "@excalidraw/common";

import type { ExcalidrawTemplate, TemplateElementSpec } from "./types";

/**
 * The sequence diagram: three participants and the messages that pass
 * between them, in the order the messages happen.
 */

const ACTOR_WIDTH = 140;
const ACTOR_HEIGHT = 48;
const ACTOR_Y = 110;

const LIFELINE_TOP = ACTOR_Y + ACTOR_HEIGHT;
const LIFELINE_BOTTOM = 540;

const ACTORS = [
  { id: "client", title: "Client", x: 120 },
  { id: "server", title: "Server", x: 400 },
  { id: "database", title: "Database", x: 680 },
];

const centerOf = (actor: typeof ACTORS[number]) => actor.x + ACTOR_WIDTH / 2;

type Message = {
  id: string;
  from: number;
  to: number;
  y: number;
  label: string;
  /** a reply is drawn without a head */
  reply?: boolean;
};

const MESSAGES: Message[] = [
  { id: "open", from: 0, to: 1, y: 200, label: "openBoard(id)" },
  { id: "load", from: 1, to: 2, y: 280, label: "loadElements()" },
  { id: "elements", from: 2, to: 1, y: 360, label: "elements[]", reply: true },
  { id: "board", from: 1, to: 0, y: 440, label: "board", reply: true },
];

const actorElements = (): TemplateElementSpec[] => [
  ...ACTORS.flatMap((actor) => [
    {
      kind: "rectangle" as const,
      id: `actor-${actor.id}`,
      x: actor.x,
      y: ACTOR_Y,
      width: ACTOR_WIDTH,
      height: ACTOR_HEIGHT,
      label: actor.title,
      fontSize: 16,
      backgroundColor: COLOR_PALETTE.gray[0],
      strokeColor: COLOR_PALETTE.gray[3],
      roundness: true,
    },
    {
      kind: "arrow" as const,
      id: `lifeline-${actor.id}`,
      x: centerOf(actor),
      y: LIFELINE_TOP,
      dx: 0,
      dy: LIFELINE_BOTTOM - LIFELINE_TOP,
      strokeColor: COLOR_PALETTE.gray[3],
      strokeWidth: 1,
      strokeStyle: "dashed" as const,
      arrowhead: false,
    },
  ]),
  ...MESSAGES.flatMap((message) => {
    const from = ACTORS[message.from];
    const to = ACTORS[message.to];
    const x = centerOf(from);
    const dx = centerOf(to) - centerOf(from);

    return [
      {
        kind: "arrow" as const,
        id: `message-${message.id}`,
        x,
        y: message.y,
        dx,
        dy: 0,
        strokeColor: COLOR_PALETTE.black,
        strokeWidth: 2,
        arrowhead: !message.reply,
      },
      {
        kind: "text" as const,
        id: `message-label-${message.id}`,
        x: Math.min(x, x + dx),
        y: message.y - 24,
        width: Math.abs(dx),
        height: 20,
        text: message.label,
        fontSize: 14,
        align: "center" as const,
        color: COLOR_PALETTE.gray[4],
      },
    ];
  }),
];

export const sequenceDiagramTemplate: ExcalidrawTemplate = {
  id: "sequence-diagram",
  nameKey: "labels.templates.items.sequenceDiagram.name",
  descriptionKey: "labels.templates.items.sequenceDiagram.description",
  category: "diagramming",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Sequence Diagram",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "Add a participant at the top, then write the messages underneath in the order they happen.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...actorElements(),
  ],
};
