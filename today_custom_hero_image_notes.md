# Today Custom Hero Image Slot

## What changed
- Added a user-customisable image slot to the Today Start hero.
- Kept the existing default soft beige CSS illustration when no custom image is set.
- Added a subtle corner edit control on the image slot.
- Added a lightweight image settings modal with:
  - upload JPEG/PNG/WebP
  - left/center/right object position
  - cover/contain fit
  - remove image
  - cancel/save flow
- Uploaded images are resized in-browser to fit within 1600 x 1200 and compressed before storing.

## Storage
- New localStorage key: `iris-appearance-settings`
- Current stored field: `todayHeroImage`
- Existing task, session, exercise, Notion, Obsidian, and app settings storage is unchanged.

## Safety
- If the compressed image is still too large or localStorage quota fails, the app shows:
  - `Image is too large. Please choose a smaller image.`
- Image changes are appearance-only and do not create activity/history records.

## Manual QA
1. Open Today.
2. Hover or tap the hero image slot.
3. Click `更换图片`.
4. Upload a JPEG/PNG/WebP.
5. Change position and fit.
6. Save and refresh the app.
7. Reopen the modal, remove the image, save, and confirm the default illustration returns.
