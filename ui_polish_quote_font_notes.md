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

The quote uses a self-hosted local font:

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

## Applied Quote Style

```css
.grounding-banner .today-note-quote-cn {
  font-family: "LXGW WenKai Screen Local", "LXGW WenKai Screen", "LXGW WenKai", "Ma Shan Zheng", "ZCOOL KuaiLe", "PingFang SC", "Microsoft YaHei", sans-serif !important;
  font-size: clamp(2.15rem, 3.4vw, 3.4rem);
  font-weight: 400 !important;
  line-height: 1.55;
  letter-spacing: 0.03em;
  color: #34251f;
}
```

The English subtitle keeps the normal UI font.

## Browser DevTools Verification

1. Open the Today tab.
2. Inspect the Chinese Today Note quote.
3. Confirm the selected element is:
   - `p.today-note-quote-cn`
4. In Computed styles, confirm:
   - `font-family` starts with `"LXGW WenKai Screen Local"`
   - `font-weight` is `400`
5. In Network, confirm this font file loads:
   - `/fonts/LXGWWenKaiScreen-Regular.ttf`

## Failure Signs

The font is still failing if computed `font-family` starts with:

- `PingFang SC`
- `Microsoft YaHei`
- `system-ui`
- `sans-serif`

Those would indicate the local font did not load or the selector was overridden.
