# Today Hero Image Non-Destructive Crop Fix

## What changed
- The Today hero image editor now preserves the full uploaded image source.
- Upload compression keeps the source aspect ratio and stores compressed natural dimensions.
- The editor preview and Today homepage now share the same `HeroImageViewport` renderer.
- Zoom and movement are saved as display settings only.
- Dragging and sliders no longer rewrite or crop the image data.

## Storage update
- `iris-appearance-settings.todayHeroImage` now supports:
  - `naturalWidth`
  - `naturalHeight`
  - `zoom`
  - `offsetX`
  - `offsetY`
- Existing images are preserved.
- If an older saved image has no dimensions, the editor shows a note asking the user to re-upload the original for full positioning.

## Rendering model
- Viewport has fixed dimensions and `overflow: hidden`.
- Image is positioned absolutely from its center.
- Base render size is calculated from natural dimensions and selected fit mode.
- Final display uses base size plus user zoom and pixel offsets.

## Manual QA
1. Upload a portrait image.
2. Confirm the compressed source keeps portrait aspect ratio.
3. Use Cover and drag vertically to choose the visible region.
4. Use Contain and confirm the full portrait can be visible.
5. Adjust Zoom, Move X, and Move Y.
6. Save and confirm the Today homepage matches the editor preview.
7. Refresh and confirm the saved position remains.
8. Use Reset crop and confirm it does not remove the image.
