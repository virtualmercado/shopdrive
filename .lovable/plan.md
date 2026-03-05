

## Analysis

After reviewing `StoreBanner.tsx`, the mobile banner code already contains `aspect-ratio: '8 / 7'` with proper `object-cover` and `object-center` styling (lines 135-142). However, the user reports the mobile banner still appears compressed.

The likely cause: the aspect-ratio value `'8 / 7'` may not be rendering as expected in all mobile browsers. Using the explicit pixel ratio `'800 / 700'` is identical mathematically but more explicit. Additionally, I will ensure no conflicting constraints exist.

## Plan

**File: `src/components/store/StoreBanner.tsx`** — Two targeted changes (mobile sections only, desktop untouched):

1. **Primary mobile carousel (lines 134-142)**: Change `aspect-ratio: '8 / 7'` to `aspect-ratio: '800 / 700'` for explicit clarity, and add `min-height: 0` to the container to prevent any flex/grid compression.

2. **Fallback mobile section (lines 183-191)**: Apply the same fix for consistency.

No changes to: desktop banner, carousel logic, autoplay, dots navigation, or banner ordering.

