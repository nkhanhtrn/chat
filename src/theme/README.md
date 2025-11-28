# Theme System

All color values for the application are centralized in [colors.css](colors.css). This allows for easy theme switching and consistent styling across the entire application.

## How to Use

### Importing the Theme

The theme is automatically imported in [main.js](../main.js), so all CSS variables are available globally throughout the application.

### Using Color Variables

In your component styles, reference colors using CSS custom properties (variables):

```css
.my-element {
  background-color: var(--color-background-white);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-light);
}
```

## Available Color Categories

### Primary Colors
- `--color-primary-gradient-start` / `--color-primary-gradient-end` - Gradient colors
- `--color-primary` - Main brand color
- `--color-primary-hover` - Hover state for primary color
- `--color-primary-light` - Light variant of primary color

### Accent Colors
- `--color-accent` - Secondary brand color
- `--color-accent-hover` - Hover state for accent color
- `--color-accent-light` / `--color-accent-lighter` - Light variants

### Background Colors
- `--color-background-white` - Pure white background
- `--color-background-light` - Light gray background
- `--color-background-paper` - Paper-like background
- `--color-background-subtle` - Subtle background
- And more variants for different states

### Border Colors
- `--color-border-light` - Light border
- `--color-border-medium` - Medium border
- `--color-border-gray` - Gray border
- And more variants

### Text Colors
- `--color-text-primary` - Primary text color
- `--color-text-secondary` - Secondary text color
- `--color-text-muted` - Muted text
- And more variants

### Special Colors
- `--color-error-background` / `--color-error-text` / `--color-error-border` - Error states
- `--color-highlight` - Highlight color
- Shadow colors with various opacity levels

## Switching Themes

To create a new theme:

1. Create a new CSS file (e.g., `colors-dark.css`)
2. Copy the structure from `colors.css`
3. Update the color values to your desired theme
4. Import the new theme file in `main.js` instead of (or in addition to) `colors.css`

### Example: Dark Theme

```css
:root {
  --color-primary: #8B5CF6;
  --color-background-white: #1a1a1a;
  --color-text-primary: #e0e0e0;
  /* ... update all other colors */
}
```

You can also implement dynamic theme switching by:
- Using JavaScript to toggle CSS classes on the root element
- Loading different CSS files based on user preference
- Using CSS custom property updates via JavaScript

## Best Practices

1. **Always use CSS variables** - Never hardcode color values in components
2. **Use semantic names** - Choose the variable that best describes the element's purpose
3. **Update the theme file** - If you need a new color, add it to `colors.css` first
4. **Test theme changes** - Update values in `colors.css` to see changes across the entire app
