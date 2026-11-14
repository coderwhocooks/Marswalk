# MARSWALK — Design System & Visual Specification

## 1. Aesthetic Direction: Tactical Planetary Mission Control
- **Inspiration:** NASA Mission Control Center (MCC), ESA ESOC telemetry workstations, and modern aerospace avionics.
- **Tone:** Grounded, authoritative, high-contrast, uncluttered, and mathematically precise.
- **Anti-Pattern Enforcement:**
  - Zero generic purple-to-blue gradient slop.
  - No nested cards or redundant border clutter.
  - Strict optical hierarchy: primary data in high-contrast white, telemetry in mono cyan/gold, hazards in unambiguous amber/red.
  - No decorative floating blobs or fake animations.

## 2. Color Palette & Tokens

| Token | Hex | Role | Usage |
|---|---|---|---|
| `--color-space-deep` | `#07090E` | Canvas Background | Root window, 3D viewport backdrop |
| `--color-panel-base` | `#0E131D` | Primary Surfaces | Sidebar, bottom dock, headers |
| `--color-panel-elevated` | `#151C2B` | Elevated Modules | Active cards, input wells, tooltips |
| `--color-border-subtle` | `#1F293D` | Structural Dividers | Section dividers, grid lines |
| `--color-border-focus` | `#38BDF8` | Focus & Selected | Active tabs, route highlight, focus rings |
| `--color-mars-rust` | `#C8482A` | Brand Accent | Logo mark, primary action buttons |
| `--color-mars-sand` | `#D97706` | Warning Accent | Moderate slope (12°-20°), shortest route mode |
| `--color-telemetry-cyan` | `#38BDF8` | Primary Route / Data | Safe traverse path, elevation profile line |
| `--color-bio-violet` | `#A855F7` | Science Targets | Geological POIs, mineralogical flags |
| `--color-safe-green` | `#10B981` | Safety Indicator | Nominal reserve margins, staging marker |
| `--color-hazard-rose` | `#F43F5E` | Critical Alarm | Hard slope exclusion (>20°), reserve breaches |
| `--color-text-bright` | `#F8FAFC` | Primary Typography | Headers, key numeric readings |
| `--color-text-muted` | `#64748B` | Secondary Telemetry | Units, labels, dataset citations |

## 3. Typography Scale & Pairings
- **Display & Interface:** System Grotesk (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) with tight optical tracking (`tracking-wide` for uppercase tags).
- **Telemetry & Coordinates:** Monospace (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`). Used for all degrees, distances, elevations, and sensor readings.

## 4. Spacing & Border Radii
- **Base Grid:** 4px baseline (`p-1` = 4px, `p-2` = 8px, `p-3` = 12px, `p-4` = 16px).
- **Radii:** `rounded-lg` (8px) for buttons/inputs, `rounded-xl` (12px) for panels, `rounded-2xl` (16px) for major modal dialogs.
- **Touch & Click Targets:** Minimum 36px height for desktop buttons with explicit hover states.

## 5. Viewport Breakpoints & Responsiveness
- **Desktop Focus (Target Viewport 1440x900):** One-screen mission control layout with fixed viewport and zero window-level page scrolling.
- **Modular Panels:** Collapsible sidebar (96rem to 14rem toggle) to maximize map and 3D terrain canvas area.
