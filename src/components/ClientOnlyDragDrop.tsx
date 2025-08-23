import { useState, useEffect } from 'react';
import * as DndKit from '@dnd-kit/core';
import * as DndKitSortable from '@dnd-kit/sortable';

const {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} = DndKit;

const {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} = DndKitSortable;

interface ClientOnlyDragDropProps {
  children: React.ReactNode;
  items: any[];
  onDragStart: (event: any) => void;
  onDragEnd: (event: any) => void;
  dragOverlay?: React.ReactNode;
}

export function ClientOnlyDragDrop({ 
  children, 
  items, 
  onDragStart, 
  onDragEnd, 
  dragOverlay 
}: ClientOnlyDragDropProps) {
  const [isClient, setIsClient] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Render without drag-and-drop during SSR
  if (!isClient) {
    return <div className="space-y-4">{children}</div>;
  }

  // Render with drag-and-drop on client
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {children}
        </div>
      </SortableContext>

      <DragOverlay>
        {dragOverlay}
      </DragOverlay>
    </DndContext>
  );
}