# Design Document

## Overview

This design focuses on reorganizing the AnimeCard component layout to improve information density and visual hierarchy. The changes involve consolidating metadata display, repositioning the MyAnimeList link as an icon-only element, and removing visual separators to create a cleaner interface.

## Architecture

The changes will be implemented within the existing AnimeCard component structure without requiring new components or major architectural changes. The modifications focus on:

1. **Metadata Consolidation**: Combining premiere date and episode count into a single display line
2. **Link Repositioning**: Moving the MyAnimeList link from the metadata section to the header area
3. **Visual Simplification**: Removing the horizontal border separator for the timeline section

## Components and Interfaces

### AnimeCard Component Modifications

The existing `AnimeCard` component will be modified in the following areas:

#### Metadata Section Layout
- **Current**: Two separate div elements for rating/episodes and premiere date
- **New**: Single div element containing rating, episodes, and premiere date
- **Format**: `[Rating] • [Episodes] • Premiered [Date]`

#### Header Section Enhancement
- **Current**: Title area with delete button on the right
- **New**: Title area with delete button and MyAnimeList icon stacked vertically on the right
- **Layout**: Delete button above, MyAnimeList icon below, both right-aligned

#### Timeline Section Integration
- **Current**: Timeline section with top border separator (`border-t`)
- **New**: Timeline section without border separator
- **Spacing**: Maintain existing margin-top for visual separation

### Data Flow

No changes to data flow or props are required. The component will continue to receive the same `AnimeCardProps` interface and process data identically.

## Data Models

No changes to existing data models are required. The component will continue to use:
- `Anime` interface for anime data
- `SeriesTimeline` type for timeline information
- Existing formatting functions (`formatRating`, `formatEpisodes`, `formatPremiereDate`)

## Error Handling

Error handling remains unchanged:
- Image loading errors continue to show placeholder
- Missing data (null values) continue to show "Unknown" or "N/A"
- Timeline errors continue to show error state

## Testing Strategy

### Unit Tests
1. **Metadata Display Tests**
   - Verify premiere date and episode count appear on same line
   - Test proper separator display between elements
   - Validate handling of null/undefined values

2. **MyAnimeList Link Tests**
   - Confirm link renders as icon only (no text)
   - Verify correct positioning relative to delete button
   - Test tooltip functionality and accessibility
   - Validate link functionality and target="_blank"

3. **Timeline Integration Tests**
   - Confirm timeline section renders without border
   - Verify visual spacing is maintained
   - Test timeline loading and error states

### Visual Regression Tests
1. Compare before/after screenshots of anime cards
2. Verify layout consistency across different screen sizes
3. Test dark mode compatibility

### Accessibility Tests
1. Verify MyAnimeList icon has proper aria-label or title
2. Confirm keyboard navigation still works correctly
3. Test screen reader compatibility

## Implementation Notes

### CSS Class Changes
- Remove `border-t` class from timeline section wrapper
- Consolidate metadata display into single flex container
- Position MyAnimeList icon in header area with appropriate spacing

### Responsive Considerations
- Ensure consolidated metadata line wraps appropriately on small screens
- Maintain icon visibility and clickability on mobile devices
- Preserve existing responsive breakpoints for image sizing

### Accessibility Enhancements
- Add `title` attribute to MyAnimeList icon for tooltip
- Maintain existing `aria-label` attributes where present
- Ensure sufficient color contrast for icon visibility