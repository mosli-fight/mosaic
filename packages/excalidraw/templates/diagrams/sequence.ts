/**
 * The sequence examples: who talks to whom, and in what order.
 *
 * A sequence diagram is read down its lifelines. Each message is drawn from
 * one participant's line to another's, in the order it happens, and a reply
 * is drawn dashed and without a head.
 */

import type { ExcalidrawTemplate } from "../types";
import type { SequenceMessage, SequenceParticipant } from "../diagram";

import { sequenceTemplate } from "../diagram";

type SequenceExample = {
  id: string;
  nameKey: ExcalidrawTemplate["nameKey"];
  descriptionKey: ExcalidrawTemplate["descriptionKey"];
  title: string;
  hint: string;
  participants: readonly SequenceParticipant[];
  messages: readonly SequenceMessage[];
};

const sequence = (example: SequenceExample): ExcalidrawTemplate =>
  sequenceTemplate({
    id: example.id,
    nameKey: example.nameKey,
    descriptionKey: example.descriptionKey,
    category: "software",
    heading: { title: example.title, hint: example.hint },
    participants: example.participants,
    messages: example.messages,
  });

export const SEQUENCE_DIAGRAMS: readonly ExcalidrawTemplate[] = [
  sequence({
    id: "seq-login",
    nameKey: "labels.templates.items.seqLogin.name",
    descriptionKey: "labels.templates.items.seqLogin.description",
    title: "Login Sequence",
    hint: "The browser sends credentials, the server checks them, and a session comes back.",
    participants: [
      { id: "browser", label: "Browser", tone: "blue" },
      { id: "server", label: "Server", tone: "violet" },
      { id: "database", label: "Database", tone: "yellow" },
    ],
    messages: [
      { from: "browser", to: "server", label: "POST /login" },
      { from: "server", to: "database", label: "findUser(email)" },
      { from: "database", to: "server", label: "user + hash", reply: true },
      { from: "server", to: "server", label: "verify password" },
      { from: "server", to: "browser", label: "Set-Cookie: session", reply: true },
    ],
  }),
  sequence({
    id: "seq-payment",
    nameKey: "labels.templates.items.seqPayment.name",
    descriptionKey: "labels.templates.items.seqPayment.description",
    title: "Payment Sequence",
    hint: "An order is charged through a provider, and the result is written back to the order.",
    participants: [
      { id: "client", label: "Checkout", tone: "blue" },
      { id: "orders", label: "Order service", tone: "violet" },
      { id: "provider", label: "Payment provider", tone: "orange" },
      { id: "ledger", label: "Ledger", tone: "yellow" },
    ],
    messages: [
      { from: "client", to: "orders", label: "POST /orders" },
      { from: "orders", to: "provider", label: "charge(amount)" },
      { from: "provider", to: "orders", label: "charge_id", reply: true },
      { from: "orders", to: "ledger", label: "record(charge)" },
      { from: "orders", to: "client", label: "201 Created", reply: true },
    ],
  }),
  sequence({
    id: "seq-oauth",
    nameKey: "labels.templates.items.seqOauth.name",
    descriptionKey: "labels.templates.items.seqOauth.description",
    title: "OAuth Sign-in Sequence",
    hint: "The authorisation code exchange: redirect, consent, code, token.",
    participants: [
      { id: "app", label: "Your app", tone: "blue" },
      { id: "user", label: "User", tone: "green" },
      { id: "idp", label: "Identity provider", tone: "violet" },
      { id: "api", label: "Resource API", tone: "yellow" },
    ],
    messages: [
      { from: "app", to: "idp", label: "authorize(client_id)" },
      { from: "idp", to: "user", label: "consent screen" },
      { from: "user", to: "idp", label: "allow", reply: true },
      { from: "idp", to: "app", label: "code", reply: true },
      { from: "app", to: "idp", label: "token(code, secret)" },
      { from: "idp", to: "app", label: "access_token", reply: true },
      { from: "app", to: "api", label: "GET /me (Bearer)" },
      { from: "api", to: "app", label: "profile", reply: true },
    ],
  }),
  sequence({
    id: "seq-cache-aside",
    nameKey: "labels.templates.items.seqCacheAside.name",
    descriptionKey: "labels.templates.items.seqCacheAside.description",
    title: "Cache-aside Sequence",
    hint: "Read the cache, fall back to the database, and write the miss back.",
    participants: [
      { id: "service", label: "Service", tone: "blue" },
      { id: "cache", label: "Redis", tone: "orange" },
      { id: "database", label: "Database", tone: "yellow" },
    ],
    messages: [
      { from: "service", to: "cache", label: "GET user:42" },
      { from: "cache", to: "service", label: "miss", reply: true },
      { from: "service", to: "database", label: "SELECT user 42" },
      { from: "database", to: "service", label: "row", reply: true },
      { from: "service", to: "cache", label: "SET user:42 ttl=60", dashed: true },
      { from: "service", to: "service", label: "return user" },
    ],
  }),
  sequence({
    id: "seq-pagination",
    nameKey: "labels.templates.items.seqPagination.name",
    descriptionKey: "labels.templates.items.seqPagination.description",
    title: "Cursor Pagination Sequence",
    hint: "The client asks for a page, the server answers with a cursor for the next one.",
    participants: [
      { id: "client", label: "Client", tone: "blue" },
      { id: "api", label: "API", tone: "violet" },
      { id: "database", label: "Database", tone: "yellow" },
    ],
    messages: [
      { from: "client", to: "api", label: "GET /items?after=42" },
      { from: "api", to: "database", label: "WHERE id > 42 LIMIT 20" },
      { from: "database", to: "api", label: "20 rows", reply: true },
      { from: "api", to: "client", label: "{ items, next: 62 }", reply: true },
      { from: "client", to: "api", label: "GET /items?after=62" },
      { from: "api", to: "client", label: "{ items, next: null }", reply: true },
    ],
  }),
  sequence({
    id: "seq-file-upload",
    nameKey: "labels.templates.items.seqFileUpload.name",
    descriptionKey: "labels.templates.items.seqFileUpload.description",
    title: "File Upload Sequence",
    hint: "Ask for a signed URL, upload straight to storage, then tell the server it landed.",
    participants: [
      { id: "client", label: "Client", tone: "blue" },
      { id: "api", label: "API", tone: "violet" },
      { id: "storage", label: "Object storage", tone: "teal" },
      { id: "worker", label: "Worker", tone: "green" },
    ],
    messages: [
      { from: "client", to: "api", label: "POST /uploads" },
      { from: "api", to: "client", label: "signed PUT url", reply: true },
      { from: "client", to: "storage", label: "PUT file" },
      { from: "storage", to: "client", label: "200 OK", reply: true },
      { from: "client", to: "api", label: "POST /uploads/complete" },
      { from: "api", to: "worker", label: "process(file)", dashed: true },
    ],
  }),
  sequence({
    id: "seq-websocket",
    nameKey: "labels.templates.items.seqWebsocket.name",
    descriptionKey: "labels.templates.items.seqWebsocket.description",
    title: "WebSocket Session Sequence",
    hint: "Upgrade the connection once, then exchange messages over it.",
    participants: [
      { id: "client", label: "Client", tone: "blue" },
      { id: "gateway", label: "Gateway", tone: "violet" },
      { id: "hub", label: "Pub/sub hub", tone: "orange" },
    ],
    messages: [
      { from: "client", to: "gateway", label: "GET /ws (Upgrade)" },
      { from: "gateway", to: "client", label: "101 Switching Protocols", reply: true },
      { from: "gateway", to: "hub", label: "subscribe(room:7)" },
      { from: "hub", to: "gateway", label: "message", reply: true },
      { from: "gateway", to: "client", label: "message", reply: true },
      { from: "client", to: "gateway", label: "ping" },
    ],
  }),
  sequence({
    id: "seq-saga",
    nameKey: "labels.templates.items.seqSaga.name",
    descriptionKey: "labels.templates.items.seqSaga.description",
    title: "Saga Compensation Sequence",
    hint: "Each step reserves something; when one fails, the steps before it are undone in reverse.",
    participants: [
      { id: "orchestrator", label: "Orchestrator", tone: "violet" },
      { id: "orders", label: "Orders", tone: "blue" },
      { id: "stock", label: "Inventory", tone: "green" },
      { id: "payments", label: "Payments", tone: "orange" },
    ],
    messages: [
      { from: "orchestrator", to: "orders", label: "createOrder" },
      { from: "orchestrator", to: "stock", label: "reserveStock" },
      { from: "orchestrator", to: "payments", label: "authorise" },
      { from: "payments", to: "orchestrator", label: "declined", reply: true },
      { from: "orchestrator", to: "stock", label: "releaseStock", dashed: true },
      { from: "orchestrator", to: "orders", label: "cancelOrder", dashed: true },
    ],
  }),
];
