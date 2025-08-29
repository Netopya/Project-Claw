# Design Document

## Overview

The timeline popover positioning issue stems from a coordinate system mismatch in the current implementation. The component calculates positions using document coordinates (by adding scroll offsets to viewport coordinates) but then applies these positions to a fixed-positioned element, which uses viewport coordinates. This design will fix the positioning by ensuring consistent use of viewport coordinates throughout.

## Architecture

The fix involves modifying the positioning calculation logic in the `TimelinePopover` component to work correctly with `position: fixed` CSS positioning. The solution maintains the existing component structure while correcting the coordinate system calculations.

### Current Problem Analysis

1. **Coordinate System Mismatch**: `getBoundingClientRect()` returns viewport coordinates, but the code adds `scrollX/scrollY` to convert to document coordinates
2. **CSS Positioning Conflict**: The popover uses `position: fixed` which positions relative to the viewport, not the document
3. **Scroll Offset Duplication**: The scroll offset is being added to coordinates that are already viewport-relative

## Components and Interfaces

### TimelinePopover Component

The existing `TimelinePopover` component will be modified with the following changes:

#### Position Calculation Logic
- Remove scroll offset additions from position calculations
- Use viewport coordinates directly since the popover is fixed-positioned
- Maintain existing placement logic (top, bottom, left, right) for intelligent positioning

#### Interface Changes
- No changes to the component's public interface
- Internal `PopoverPosition` interface remains the same
- `calculatePosition()` method logic will be updated

## Data Models

No changes to existing data models are required. The component will continue to use:

- `PopoverPosition` interface with `top`, `left`, and `placement` properties
- Existing `TimelineEntry` and related types remain unchanged

## Error Handling

The existing error handling will be preserved:

- Graceful fallback when `anchorElement` or `popoverRef` are null
- Default position values when calculations fail
- Existing click-outside and escape key handling

## Testing Strategy

### Unit Tests
1. **Position Calculation Tests**
   - Test positioning with various scroll positions
   - Verify correct placement when anchor is near viewport edges
   - Test fallback positioning when preferred placement doesn't fit

2. **Viewport Boundary Tests**
   - Test popover positioning at top edge of viewport
   - Test popover positioning at bottom edge of viewport
   - Test popover positioning at left and right edges

3. **Responsive Behavior Tests**
   - Test position recalculation on window resize
   - Test position updates when anchor element moves

### Integration Tests
1. **Timeline Badge Integration**
   - Test popover positioning with actual timeline badges
   - Verify positioning across different anime card layouts
   - Test with various timeline badge configurations

### Manual Testing Scenarios
1. **Scroll Position Testing**
   - Test with page scrolled to top, middle, and bottom
   - Verify consistent positioning across all scroll positions

2. **Multi-Row Testing**
   - Test popovers on first row of anime cards
   - Test popovers on subsequent rows
   - Verify no displacement based on row position

## Implementation Details

### Key Changes to `calculatePosition()` Method

1. **Remove Scroll Offset Additions**
   ```typescript
   // Remove these lines:
   const scrollX = window.scrollX;
   const scrollY = window.scrollY;
   
   // And remove scrollX/scrollY from position calculations
   ```

2. **Use Viewport Coordinates Directly**
   ```typescript
   // Use anchorRect coordinates directly without scroll offset
   let top = anchorRect.top - popoverRect.height - 8;
   let left = anchorRect.left + (anchorRect.width / 2) - (popoverRect.width / 2);
   ```

3. **Update Boundary Checks**
   ```typescript
   // Check against viewport boundaries directly
   if (top < 8) {
     // Position below instead
     top = anchorRect.bottom + 8;
   }
   ```

### Viewport Boundary Handling

The design maintains the existing intelligent placement logic but ensures all calculations work with viewport coordinates:

1. **Vertical Placement**: Check if popover fits above or below the anchor within viewport
2. **Horizontal Placement**: Fall back to left/right placement if vertical doesn't fit
3. **Boundary Constraints**: Ensure popover stays within viewport bounds with 8px margin

### Performance Considerations

- No performance impact as the fix simplifies calculations by removing unnecessary scroll offset operations
- Existing resize and scroll event handlers remain unchanged
- Position recalculation frequency stays the same