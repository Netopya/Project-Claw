# Implementation Plan

- [x] 1. Fix coordinate system mismatch in TimelinePopover positioning






  - Remove scroll offset calculations from `calculatePosition()` method
  - Update position calculations to use viewport coordinates directly
  - Modify boundary checking logic to work with viewport-relative coordinates
  - Test positioning with various scroll positions to ensure consistency
  - _Requirements: 1.1, 1.2, 1.3, 2.1_

- [x] 2. Update viewport boundary detection logic






  - Modify top/bottom placement boundary checks to use viewport coordinates
  - Update left/right placement fallback logic for viewport boundaries
  - Ensure 8px margin is maintained from all viewport edges
  - Test edge case positioning near viewport boundaries

  - _Requirements: 2.2, 3.1, 3.2, 3.3, 3.4_

- [x] 3. Add comprehensive positioning tests



  - Write unit tests for position calculation with different scroll positions
  - Create tests for viewport boundary edge cases
  - Add tests for placement direction selection logic
  - Test position recalculation on window resize events
  - _Requirements: 1.1, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_