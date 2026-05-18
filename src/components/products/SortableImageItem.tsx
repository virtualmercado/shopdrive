import { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface SortableImageItemProps {
  id: string;
  children: ReactNode;
}

/**
 * Sortable wrapper used to enable drag-and-drop reordering of product
 * images inside the product edit modal. Adds a discrete drag handle so
 * that clicks on existing action buttons (delete, set primary, edit on
 * double-click) are never hijacked by the drag interaction.
 */
export const SortableImageItem = ({ id, children }: SortableImageItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {children}
      {/* Drag handle — only this small zone starts a drag */}
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        title="Arrastar para reordenar"
        className="absolute bottom-1 right-1 z-20 h-6 w-6 rounded-md bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
        onClick={(e) => e.preventDefault()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
