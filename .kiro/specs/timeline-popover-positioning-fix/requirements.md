# Requirements Document

## Introduction

The timeline popover component currently has positioning issues where popovers appear much lower on the screen than their target timeline elements. This occurs because the positioning calculation incorrectly mixes viewport-relative coordinates with document-relative coordinates, causing popovers to be displaced by the scroll offset. The issue is most noticeable for anime in the first row (appearing at the bottom of the screen) and becomes worse for subsequent rows (appearing below the fold).

## Requirements

### Requirement 1

**User Story:** As a user viewing anime timeline badges, I want popovers to appear directly adjacent to the badge I'm hovering over, so that I can easily see the relationship between the popover content and its trigger element.

#### Acceptance Criteria

1. WHEN a user hovers over a timeline badge THEN the popover SHALL appear immediately adjacent to the badge (above, below, left, or right based on available space)
2. WHEN the popover is positioned THEN it SHALL maintain consistent spacing (8px) from the target element
3. WHEN multiple timeline badges are visible THEN each popover SHALL appear correctly positioned relative to its specific trigger badge

### Requirement 2

**User Story:** As a user scrolling through anime cards with timelines, I want popovers to remain properly positioned regardless of scroll position, so that the popover content is always readable and contextually relevant.

#### Acceptance Criteria

1. WHEN the page is scrolled to any position THEN popovers SHALL appear in the correct location relative to their trigger elements
2. WHEN a popover is displayed near the viewport edges THEN it SHALL automatically adjust its position to remain fully visible
3. WHEN the viewport is resized while a popover is open THEN the popover SHALL reposition itself appropriately

### Requirement 3

**User Story:** As a user on different screen sizes, I want popovers to intelligently choose their placement direction, so that they remain fully visible and don't get cut off by screen boundaries.

#### Acceptance Criteria

1. WHEN there is insufficient space above a trigger element THEN the popover SHALL appear below the element
2. WHEN there is insufficient space below a trigger element THEN the popover SHALL appear above the element
3. WHEN there is insufficient vertical space in either direction THEN the popover SHALL appear to the left or right of the element
4. WHEN the popover would extend beyond viewport boundaries THEN it SHALL be repositioned to remain fully visible within the viewport