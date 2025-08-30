# Requirements Document

## Introduction

This feature focuses on improving the layout and visual hierarchy of the AnimeCard component by reorganizing metadata display, simplifying the MyAnimeList link presentation, and removing redundant visual elements to create a cleaner, more compact design.

## Requirements

### Requirement 1

**User Story:** As a user viewing my anime watchlist, I want the premiere date and episode count displayed together on the same line, so that I can quickly see both pieces of information without scanning multiple lines.

#### Acceptance Criteria

1. WHEN viewing an anime card THEN the premiere date SHALL be displayed on the same line as the episode count
2. WHEN both premiere date and episode count are available THEN they SHALL be separated by a bullet point (•) or similar visual separator
3. WHEN the premiere date is unknown THEN it SHALL still display "Unknown" alongside the episode count
4. WHEN the episode count is unknown THEN it SHALL still display "Unknown" alongside the premiere date

### Requirement 2

**User Story:** As a user who wants to access MyAnimeList links, I want the link to be represented by just an icon positioned below the delete button, so that the interface is cleaner and the link doesn't compete visually with other text content.

#### Acceptance Criteria

1. WHEN viewing an anime card THEN the MyAnimeList link SHALL display only an external link icon without text
2. WHEN viewing an anime card THEN the MyAnimeList link SHALL be positioned below the delete button in the top-right area
3. WHEN hovering over the MyAnimeList link icon THEN it SHALL show a tooltip indicating "View on MyAnimeList"
4. WHEN clicking the MyAnimeList link icon THEN it SHALL open the anime's MyAnimeList page in a new tab
5. WHEN viewing an anime card THEN the MyAnimeList link SHALL maintain appropriate hover states and accessibility

### Requirement 3

**User Story:** As a user viewing anime cards, I want unnecessary visual separators removed, so that the interface appears cleaner and less cluttered.

#### Acceptance Criteria

1. WHEN viewing an anime card THEN there SHALL be no horizontal line separating the timeline section from the metadata
2. WHEN a timeline is present THEN it SHALL be visually integrated with the rest of the card content without additional borders
3. WHEN no timeline is present THEN the card layout SHALL remain consistent and clean
4. WHEN viewing multiple anime cards THEN the visual consistency SHALL be maintained across all cards