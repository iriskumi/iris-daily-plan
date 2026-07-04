# Today Note Quote Font Debug Notes

## Exact Component

- File: `src/App.tsx`
- Element:

```tsx
<p className="today-note-quote-cn" lang="zh-Hans">
```

This is the Chinese quote inside the Today Note card.

## Exact CSS Selector

- File: `src/index.css`
- Selector:

```css
.grounding-banner .today-note-quote-cn
```

The selector now applies the quote font directly to the Chinese quote element.

## Font Loading

The quote now uses a self-hosted local handwritten/note-style font first:

```text
public/fonts/MaShanZheng-Regular.ttf
```

Registered as:

```css
@font-face {
  font-family: "Ma Shan Zheng Local";
  src: url("/fonts/MaShanZheng-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

The previous local fonts remain available as fallbacks:

```text
public/fonts/ELEYANG-Plog.ttf
public/fonts/LXGWWenKaiScreen-Regular.ttf
```

```text
public/fonts/LXGWWenKaiScreen-Regular.ttf
```

Registered as:

```css
@font-face {
  font-family: "LXGW WenKai Screen Local";
  src: url("/fonts/LXGWWenKaiScreen-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

Note: the official repository currently provides `LXGWWenKai-Regular.ttf`; it is stored locally under the requested stable public filename and registered as `LXGW WenKai Screen Local` for the app.

The first attempt with LXGW worked technically, but visually it still looked too regular/print-like in the large Today Note quote. `Ma Shan Zheng Local` is now first because it gives a much more obvious handwritten note style.

## Applied Quote Style

```css
.grounding-banner .today-note-quote-cn {
  font-family: "Ma Shan Zheng Local", "Ma Shan Zheng", "ELEYANG Plog", "LXGW WenKai Screen Local", "LXGW WenKai Screen", "LXGW WenKai", "ZCOOL KuaiLe", "PingFang SC", "Microsoft YaHei", sans-serif !important;
  font-size: clamp(2.25rem, 3.45vw, 3.65rem);
  font-weight: 400 !important;
  line-height: 1.42;
  letter-spacing: 0.045em;
  color: #34251f;
  font-synthesis: none;
}
```

The English subtitle keeps the normal UI font.

## Browser DevTools Verification

1. Open the Today tab.
2. Inspect the Chinese Today Note quote.
3. Confirm the selected element is:
   - `p.today-note-quote-cn`
4. In Computed styles, confirm:
   - `font-family` starts with `"Ma Shan Zheng Local"`
   - `font-weight` is `400`
5. In Network, confirm this font file loads:
   - `/fonts/MaShanZheng-Regular.ttf`

## Failure Signs

The font is still failing if computed `font-family` starts with:

- `ELEYANG Plog` and still does not look handwritten enough
- `LXGW WenKai Screen Local` but the visual still feels too regular
- `PingFang SC`
- `Microsoft YaHei`
- `system-ui`
- `sans-serif`

Those would indicate the local font did not load or the selector was overridden.
