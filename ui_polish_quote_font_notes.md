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

The quote now uses a self-hosted local handwriting font first:

```text
public/fonts/ELEYANG-Plog.ttf
```

Registered as:

```css
@font-face {
  font-family: "ELEYANG Plog";
  src: url("/fonts/ELEYANG-Plog.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

LXGW WenKai remains available as the second local/named fallback:

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

The first attempt with LXGW worked technically, but visually it still looked too regular/print-like in the large Today Note quote. `ELEYANG Plog` is now first because it gives a more obvious handwritten notebook style and its cmap includes the quote characters.

## Applied Quote Style

```css
.grounding-banner .today-note-quote-cn {
  font-family: "ELEYANG Plog", "LXGW WenKai Screen Local", "LXGW WenKai Screen", "LXGW WenKai", "Ma Shan Zheng", "ZCOOL KuaiLe", "PingFang SC", "Microsoft YaHei", sans-serif !important;
  font-size: clamp(2rem, 3.05vw, 3.05rem);
  font-weight: 400 !important;
  line-height: 1.55;
  letter-spacing: 0.035em;
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
   - `font-family` starts with `"ELEYANG Plog"`
   - `font-weight` is `400`
5. In Network, confirm this font file loads:
   - `/fonts/ELEYANG-Plog.ttf`
   - `/fonts/LXGWWenKaiScreen-Regular.ttf` may also appear as fallback/available font

## Failure Signs

The font is still failing if computed `font-family` starts with:

- `LXGW WenKai Screen Local` but the visual still feels too regular
- `PingFang SC`
- `Microsoft YaHei`
- `system-ui`
- `sans-serif`

Those would indicate the local font did not load or the selector was overridden.
