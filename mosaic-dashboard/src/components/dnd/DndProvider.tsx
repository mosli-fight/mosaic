import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState, type ReactNode } from "react";

import { FOLDER_COLOR_MAP } from "@/components/sidebar/Sidebar";
import { useDashboardStore } from "@/state/useDashboardStore";

/**
 * Single DndContext for the whole dashboard (STEP 4: drag a board onto a folder).
 *
 * Why it lives at the shell level and not inside BoardGrid: the drop targets are
 * the *sidebar folder rows*, which are a sibling of the grid. A DndContext only
 * covers its own subtree, so scoping it to the grid would leave the sidebar
 * unable to receive drops. One provider around the shell fixes that and keeps a
 * single source of truth for the drag-end handler.
 *
 * Droppable id convention:
 *   `folder:<id>`  → file the board into that folder
 *   `grid`         → drop on the board grid itself = remove from any folder
 * The prefix matters: folder ids are UUIDs and could theoretically collide with
 * board ids, and board ids are used as draggable ids.
 */
export const FOLDER_DROPPABLE_PREFIX = "folder:";
export const GRID_DROPPABLE_ID = "grid";

export const DndProvider = ({ children }: { children: ReactNode }) => {
  const moveBoardToFolder = useDashboardStore((s) => s.moveBoardToFolder);
  const [activeName, setActiveName] = useState<string | null>(null);

  const sensors = useSensors(
    // An activation distance is required: without it a plain click on a card
    // would start a drag and swallow the click that opens the board.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const board = useDashboardStore
      .getState()
      .boards.find((b) => b.id === String(event.active.id));
    setActiveName(board?.name ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveName(null);
    const { active, over } = event;
    if (!over) {
      return;
    }
    const overId = String(over.id);
    const boardId = String(active.id);

    if (overId.startsWith(FOLDER_DROPPABLE_PREFIX)) {
      await moveBoardToFolder(
        boardId,
        overId.slice(FOLDER_DROPPABLE_PREFIX.length),
      );
      return;
    }
    if (overId === GRID_DROPPABLE_ID) {
      await moveBoardToFolder(boardId, null);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveName(null)}
    >
      {children}
      <DragOverlay>
        {activeName ? (
          <div
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              background: "var(--color-surface)",
              boxShadow: "0 12px 32px rgba(31, 39, 51, 0.22)",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              border: `1px solid ${FOLDER_COLOR_MAP.blue}`,
            }}
            data-testid="drag-overlay"
          >
            {activeName}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
