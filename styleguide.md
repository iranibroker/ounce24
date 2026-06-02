# UI Styleguide & Styling Best Practices

This guide documents the design system, custom components, overrides, and layout practices used in the **ounce24** application. Follow these specifications for all future features to ensure UI consistency and visual excellence.

---

## 1. Design Philosophy: Slate Glassmorphism

The application utilizes a dark slate glassmorphic aesthetic to create a premium, modern feel. 

*   **Primary Theme Accent:** Gold/Yellow (`#FFD700` / `var(--mat-sys-primary)`) — used selectively for active states, primary CTA buttons, and highlighted metrics.
*   **Body Background:** Deep Rich Black/Slate (`#090d16`).
*   **Card & Surface Container Background:** Translucent slate with blur (`rgba(30, 41, 59, 0.45)` with `backdrop-filter: blur(16px)`).
*   **Border Styling:** Avoid heavy borders. Use thin, semi-transparent white borders (`1px solid rgba(255, 255, 255, 0.07)`) to define glass boundaries.
*   **Border Radius System:**
    *   **Standard Cards/Inputs/Buttons/Avatars:** `12px`
    *   **Dialogs/Modals/Chips:** `20px`
    *   **Toggles/Tab Switchers/Pills:** `30px` (or `26px` for inner toggle elements)

---

## 2. Form Fields & Inputs (`mat-form-field`)

To ensure clean border outlines and bypass Angular Material notch-calculation/clipping bugs, all forms must follow these layout rules:

### A. Place Labels Externally (No Floating Labels)
Never place a `<mat-label>` inside the `<mat-form-field>`. Hiding the notch border dynamically causes overlapping text issues. Instead, place labels outside the input fields.

### B. Vertical Layout (Labels Above Inputs)
For standard form layouts, place a custom label header directly above the `<mat-form-field>`.

**HTML Template:**
```html
<div class="input-label">Label Text</div>
<mat-form-field appearance="outline">
  <input matInput placeholder="Placeholder Text" />
</mat-form-field>
```

**SCSS Styling:**
Use the global `.input-label` class:
```scss
.input-label {
  display: block;
  font-size: 0.88rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: -6px; // Snug alignment with input box
  margin-top: 8px;
}
```

### C. Horizontal Layout (Label beside Input - e.g., Add Signal Page)
For simple fields where input text is short, place the label on the left side of the input box in a horizontal row. Align them vertically in the center.

To prevent validation error messages (`mat-error`) from shifting the input box downward (which breaks the vertical alignment with the left label), style the error container absolutely.

**HTML Template:**
```html
<div class="form-row">
  <label class="row-label">Label Text</label>
  <mat-form-field appearance="outline">
    <input matInput placeholder="Placeholder Text" />
    <mat-error *ngIf="control.errors">Error message</mat-error>
  </mat-form-field>
</div>
```

**SCSS Styling:**
```scss
.form-row {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  margin-bottom: 24px; // Reserve space for absolute validation errors at the bottom

  .row-label {
    width: 120px;
    font-size: 0.9rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    text-align: right;
  }

  mat-form-field {
    flex: 1;

    // Absolutely position subscript to prevent layout shifts on validation errors
    ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      position: absolute;
      top: 100%;
      left: 0;
      width: 100%;
      height: auto;
      margin-top: 2px;
    }
  }
}
```

### D. Prefix & Suffix Icons
Prefix/suffix icons should have comfortable spacing so they don't clip into input borders.
*   **Spacings:** `margin-inline-end: 12px` and `margin-inline-start: 8px` on input icon wrapper classes.
*   Increase default font size for errors (`0.88rem`, `500` weight) and hints (`0.85rem`) to guarantee legibility on dark background screens.

---

## 3. Segmented Switchers & Toggles (`mat-button-toggle-group`)

Button toggles must resemble clean, modern segmented pills instead of outdated squared boxes.

### A. Hide the Selection Tick Mark (`✓`)
Always specify `hideSingleSelectionIndicator` on the toggle group, and ensure the CSS rules hide the SVG element globally to avoid layout layout offset.

**HTML Template:**
```html
<mat-button-toggle-group hideSingleSelectionIndicator="true">
  <mat-button-toggle value="active">Active</mat-button-toggle>
  <mat-button-toggle value="pending">Pending</mat-button-toggle>
</mat-button-toggle-group>
```

### B. Center Toggle Button Text
To keep toggle text perfectly centered, override the inner Material layout paddings:
```scss
.mat-mdc-button-toggle-group {
  background: rgba(15, 23, 42, 0.45) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 30px !important;
  padding: 3px !important;
  display: flex !important;
  align-items: center !important;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2) !important;

  .mat-mdc-button-toggle {
    flex: 1 !important;
    background: transparent !important;
    border-radius: 26px !important;

    // Reset Material padding to zero to center content symmetrically
    .mat-mdc-button-toggle-button {
      padding: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
    }

    // Centered label content inside toggle
    .mat-button-toggle-label-content {
      line-height: 34px !important;
      padding: 0 12px !important;
      font-size: 0.82rem !important;
      text-align: center !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      gap: 4px !important;
    }
    
    &.mat-button-toggle-checked {
      background: rgba(255, 255, 255, 0.09) !important;
      color: #ffd700 !important;
      font-weight: 600 !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
    }
  }
}
```

---

## 4. Modern Tab Switchers (`mat-tab-group`)

Tab headers must match the segmented capsule design used for button toggles.

### A. Remove Outdated Ink-Bars and Dividers
*   Disable the horizontal divider line at the bottom of the tab header container.
*   Hide the default colored active line indicator (ink bar) completely.
*   Instead, highlight active tabs using a subtle background capsule and gold/yellow colored text.

### B. Tabs SCSS Configuration
Keep the tab configuration clean by setting custom property values or using component overrides.

```scss
.mat-mdc-tab-group,
mat-tab-group {
  // Clear default Material indicator lines and underlines
  --mdc-tab-indicator-active-indicator-color: transparent !important;
  --mdc-tab-indicator-active-indicator-height: 0px !important;
  --mat-tab-header-active-indicator-color: transparent !important;
  --mat-tab-header-divider-color: transparent !important;
  --mat-tab-header-divider-height: 0px !important;

  .mat-mdc-tab-header {
    border-bottom: none !important;
    margin-bottom: 12px !important;
  }

  .mat-mdc-tab-labels {
    background: rgba(15, 23, 42, 0.45) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 30px !important;
    padding: 3px !important;
    display: flex !important;
    margin: 8px 16px !important;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2) !important;
  }

  .mat-mdc-tab {
    flex: 1 !important;
    height: 36px !important;
    min-height: 36px !important;
    border-radius: 26px !important;
    color: rgba(241, 245, 249, 0.5) !important;
    font-weight: 500 !important;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;

    .mdc-tab__text-label {
      color: inherit !important;
      font-size: 0.82rem !important;
    }

    &.mdc-tab--active {
      background: rgba(255, 255, 255, 0.09) !important;
      color: #ffd700 !important;
      font-weight: 600 !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
    }
  }
}
```

---

## 5. Interactive Buttons & Icons

Buttons must feature rounded corners, clear sizing, and scale transitions on click/tap to feel premium.

### A. Rounded Borders & Sizing
*   **Border Radius:** `12px !important` on standard buttons and icon-buttons.
*   **Font Size:** `0.95rem` for better readability.
*   **Padding & Gap:** Use flex-based alignment with `gap: 8px` to cleanly separate icons from text.

### B. Micro-Animations
Add interactive click feedbacks to make elements feel responsive:
```scss
.mat-mdc-button,
.mat-mdc-unelevated-button,
.mat-mdc-flat-button,
.mat-mdc-raised-button,
.mat-mdc-outlined-button,
.mat-mdc-icon-button {
  &:active {
    transform: scale(0.96) !important; // Micro-scaling on press
  }
}
```

### C. Gradient Call-To-Action (CTA) Primary Button
Primary actions must stand out with a polished gold gradient.
```scss
.mat-mdc-flat-button.mat-primary,
.mat-mdc-unelevated-button.mat-primary {
  background: linear-gradient(135deg, #ffd700 0%, #e5a900 100%) !important;
  color: #020617 !important;
  box-shadow: 0 4px 14px rgba(255, 215, 0, 0.25) !important;

  &:hover {
    box-shadow: 0 6px 20px rgba(255, 215, 0, 0.4) !important;
    transform: scale(1.02) !important;
  }
}
```
