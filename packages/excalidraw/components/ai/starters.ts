/**
 * Ready-made prompts for the kinds of diagram people draw most.
 *
 * A starter is not a model of its own and it is not sent anywhere by itself:
 * it is a piece of text that the person can edit in the prompt box before
 * they send it. Each one repeats the output contract the parser expects
 * (a json array of elements) and shows a worked example, because a model
 * that is told the shape of the answer produces a diagram the parser can
 * read far more often than one that is not.
 *
 * The prompts are written in English on purpose: they are instructions to
 * the model, not text for the person, and every provider handles English
 * instructions best.
 */

import type { TranslationKeys } from "../../i18n";

/** the diagram types a starter is offered for */
export type AIDiagramStarterId =
  | "architecture"
  | "flowchart"
  | "erd"
  | "sequence"
  | "bpmn"
  | "document";

/** a starter: a labelled prompt and a few one-click examples */
export type AIDiagramStarter = {
  id: AIDiagramStarterId;
  /** the i18n key of the chip's label */
  labelKey: TranslationKeys;
  /** what clicking the chip puts in the prompt box */
  prompt: string;
  /** concrete prompts that can be inserted with one click */
  examples: readonly string[];
};

/**
 * The output contract, in the words the model needs.
 *
 * This is deliberately a shorter version of the system prompt: the starter
 * is the person's message, and repeating the contract there keeps the model
 * on the rails even when a provider treats the system prompt loosely.
 */
const FORMAT = [
  "Answer with a single JSON array and nothing else: no prose, no markdown, no code fences.",
  'Every item is an object with "type" ("rectangle", "ellipse", "diamond", "text" or "arrow"),',
  '"x" and "y" (numbers, the position on the board) and "text" (the label).',
  'Shapes also take "width" and "height"; arrows take "x2" and "y2" for their far end.',
].join("\n");

/** builds a starter prompt from its instructions and its worked examples */
const starter = (
  instructions: readonly string[],
  examples: readonly string[],
): string => [...instructions, FORMAT, "Example:", ...examples].join("\n");

export const DIAGRAM_STARTERS: readonly AIDiagramStarter[] = [
  {
    id: "architecture",
    labelKey: "labels.ai.starterArchitecture",
    prompt: starter(
      [
        "Draw a system architecture diagram.",
        "Use rectangles for services and data stores, and arrows for the calls between them, labelled with the protocol or the data that flows.",
        "Lay the diagram out left to right in tiers: clients, then edge, then application, then data. Leave about 80px between boxes and 120px between tiers.",
      ],
      [
        '[{"type":"rectangle","x":0,"y":0,"width":160,"height":80,"text":"ALB"},' +
          '{"type":"arrow","x":80,"y":80,"x2":80,"y2":160,"text":"HTTPS"},' +
          '{"type":"rectangle","x":0,"y":160,"width":160,"height":80,"text":"EC2"},' +
          '{"type":"arrow","x":80,"y":240,"x2":80,"y2":320,"text":"SQL"},' +
          '{"type":"ellipse","x":0,"y":320,"width":160,"height":80,"text":"RDS"}]',
      ],
    ),
    examples: [
      "AWS 3-tier web app with ALB, EC2, RDS",
      "Event-driven order service with API Gateway, SQS and Lambda",
      "Next.js app with Postgres and a Redis cache",
    ],
  },
  {
    id: "flowchart",
    labelKey: "labels.ai.starterFlowchart",
    prompt: starter(
      [
        "Draw a flowchart.",
        "Use ellipses for the start and the end, rectangles for steps, diamonds for decisions, and arrows for the flow.",
        'Label each arrow that leaves a decision with "yes" or "no". Lay it out top to bottom, about 120px between rows.',
      ],
      [
        '[{"type":"ellipse","x":0,"y":0,"width":160,"height":80,"text":"Start"},' +
          '{"type":"arrow","x":80,"y":80,"x2":80,"y2":160},' +
          '{"type":"rectangle","x":0,"y":160,"width":160,"height":80,"text":"Read input"},' +
          '{"type":"arrow","x":80,"y":240,"x2":80,"y2":320},' +
          '{"type":"diamond","x":0,"y":320,"width":160,"height":100,"text":"Valid?"},' +
          '{"type":"arrow","x":160,"y":370,"x2":280,"y2":370,"text":"no"},' +
          '{"type":"arrow","x":80,"y":420,"x2":80,"y2":500,"text":"yes"},' +
          '{"type":"ellipse","x":0,"y":500,"width":160,"height":80,"text":"End"}]',
      ],
    ),
    examples: [
      "Customer support ticket triage",
      "CI pipeline from commit to deploy",
      "User signup with email verification",
    ],
  },
  {
    id: "erd",
    labelKey: "labels.ai.starterErd",
    prompt: starter(
      [
        "Draw an entity-relationship diagram.",
        'Use one rectangle per entity. Put the entity name on the first line of its text and its fields on the lines below, marking the primary key with "PK:" and foreign keys with "FK:".',
        'Connect entities with arrows labelled with the cardinality ("1:N", "N:M"). Lay entities out in a grid, about 240px apart horizontally.',
      ],
      [
        '[{"type":"rectangle","x":0,"y":0,"width":200,"height":140,"text":"users\\nPK: id\\nemail\\nname"},' +
          '{"type":"arrow","x":200,"y":60,"x2":360,"y2":60,"text":"1:N"},' +
          '{"type":"rectangle","x":360,"y":0,"width":200,"height":140,"text":"posts\\nPK: id\\nFK: user_id\\ntitle"}]',
      ],
    ),
    examples: [
      "Blog: users, posts, comments with foreign keys",
      "E-commerce: customers, orders, order_items, products",
      "SaaS billing: accounts, subscriptions, invoices",
    ],
  },
  {
    id: "sequence",
    labelKey: "labels.ai.starterSequence",
    prompt: starter(
      [
        "Draw a sequence diagram.",
        "Put each participant in a rectangle across the top, about 200px apart.",
        "Draw each message as an arrow from the sender's column to the receiver's column, stepping about 60px down the page for each message, and label the arrow with the message.",
        "Keep the messages in the order they happen, top to bottom.",
      ],
      [
        '[{"type":"rectangle","x":0,"y":0,"width":160,"height":60,"text":"Browser"},' +
          '{"type":"rectangle","x":200,"y":0,"width":160,"height":60,"text":"API"},' +
          '{"type":"arrow","x":80,"y":60,"x2":280,"y2":120,"text":"POST /login"},' +
          '{"type":"arrow","x":280,"y":180,"x2":80,"y2":240,"text":"200 OK + token"}]',
      ],
    ),
    examples: [
      "OAuth login between browser, app and identity provider",
      "Checkout: browser, API, payment provider, database",
      "Password reset by email",
    ],
  },
  {
    id: "bpmn",
    labelKey: "labels.ai.starterBpmn",
    prompt: starter(
      [
        "Draw a BPMN process.",
        "Use an ellipse for the start event and for the end event, rectangles for tasks, diamonds for gateways, and arrows for the sequence flow.",
        "Label each arrow that leaves a gateway with its condition. Lay it out left to right, about 120px between steps.",
      ],
      [
        '[{"type":"ellipse","x":0,"y":0,"width":160,"height":80,"text":"Start"},' +
          '{"type":"arrow","x":160,"y":40,"x2":280,"y2":40},' +
          '{"type":"rectangle","x":280,"y":0,"width":160,"height":80,"text":"Submit claim"},' +
          '{"type":"arrow","x":440,"y":40,"x2":560,"y2":40},' +
          '{"type":"diamond","x":560,"y":-10,"width":160,"height":100,"text":"Approved?"},' +
          '{"type":"arrow","x":720,"y":40,"x2":840,"y2":40,"text":"yes"},' +
          '{"type":"rectangle","x":840,"y":0,"width":160,"height":80,"text":"Pay out"},' +
          '{"type":"arrow","x":640,"y":90,"x2":640,"y2":180,"text":"no"},' +
          '{"type":"rectangle","x":560,"y":180,"width":160,"height":80,"text":"Return to claimant"}]',
      ],
    ),
    examples: [
      "Employee onboarding approval",
      "Expense claim from submission to payout",
      "Purchase order approval with a manager gateway",
    ],
  },
  {
    id: "document",
    labelKey: "labels.ai.starterDocument",
    prompt: starter(
      [
        "Draft a document as a structured outline on the board.",
        "Use text elements for the title, the headings and the paragraphs. Use rectangles only to frame a section that needs emphasis.",
        "Put the title at the top, each heading about 40px below the block before it, and its paragraphs about 28px below the heading. Keep each text element under 80 characters per line.",
      ],
      [
        '[{"type":"text","x":0,"y":0,"width":420,"text":"Product brief"},' +
          '{"type":"text","x":0,"y":60,"width":420,"text":"Problem\\nTeams cannot see what changed between releases."},' +
          '{"type":"text","x":0,"y":140,"width":420,"text":"Success\\nEvery release has a one-page summary within a day."}]',
      ],
    ),
    examples: [
      "One-page product brief: problem, solution, metrics",
      "API reference outline for a REST endpoint",
      "Meeting notes with decisions and action items",
    ],
  },
];
