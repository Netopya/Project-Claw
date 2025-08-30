# Implementation Plan

- [x] 1. Consolidate metadata display to show premiere date beside episode count


  - Modify the metadata section in AnimeCard.tsx to combine rating, episodes, and premiere date into a single line
  - Update the JSX structure to display format: "[Rating] • [Episodes] • Premiered [Date]"
  - Ensure proper handling of null/undefined values for both episode count and premiere date
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Reposition MyAnimeList link as icon-only element in header area

  - Move the MyAnimeList link from the metadata section to the header area below the delete button
  - Remove the text "View on MyAnimeList" and display only the external link icon
  - Position the icon in the top-right area, stacked below the delete button
  - Add appropriate tooltip/title attribute for accessibility
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Remove horizontal line separator from timeline section

  - Remove the `border-t` class from the timeline section wrapper div
  - Maintain existing margin-top spacing for visual separation
  - Ensure timeline integration appears clean without the border separator
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Update component tests to reflect layout changes





  - Modify existing AnimeCard.test.tsx to test consolidated metadata display
  - Add tests for MyAnimeList icon positioning and tooltip functionality
  - Update tests to verify timeline section renders without border
  - Ensure all accessibility requirements are covered in tests
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_