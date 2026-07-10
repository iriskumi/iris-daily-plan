# Today Editorial Image Layering Notes

Visual polish completed for the Today page only.

What changed:

- Added a soft editorial Start hero composition with a CSS-only lifestyle image block.
- Added blush brush-stroke underline under the `Start` heading.
- Added a layered Next card with a CSS-only coffee / notebook visual panel.
- Added warmer shadows, beige borders, rounded image corners, paper-like washes, and softer list-card depth.
- Updated the Next action button copy from generic `Start` to `Start 25-min` / `Start Study` where applicable.
- Kept the existing Start / Next / Note / Done / Queue structure and behavior unchanged.

No external image URLs were added.

Current placeholders are CSS-only. If real local images are added later, suggested paths are:

- `/public/assets/soft-desk.jpg`
- `/public/assets/coffee-notebook.jpg`
- `/public/assets/dried-flowers.jpg`
- `/public/assets/linen-texture.jpg`

Design direction:

- Milk foam / vanilla / oat / blush palette
- Soft lifestyle dashboard, not a blog
- Feminine and editorial, but still action-first
- No hot pink, dark stock imagery, people photos, or busy image areas

Validation:

- Run `npm run build`
- Run `git diff --check`

