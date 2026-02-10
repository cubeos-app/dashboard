# Session C: Drag-and-Drop Edit Mode — Handover

## Files Created/Modified (1 new + 4 modified)

### 1. `src/composables/useDashboardEdit.js` (NEW)
**Purpose:** Singleton composable managing dashboard edit mode state and drag-drop logic.
**Exports:**
- `isEditing` (readonly ref) — whether edit mode is active
- `dragWidgetId` (readonly ref) — ID of the widget currently being dragged
- `dragSourceRowIdx` (readonly ref) — source row index of dragged widget
- `toggleEdit()` — toggle edit mode on/off, clears drag state on exit
- `exitEdit()` — force-exit edit mode
- `startDrag(widgetId, rowIdx)` — called on dragstart
- `endDrag()` — called on dragend, clears drag state
- `handleDrop(targetRowIdx, position)` — moves widget to target; position is 'left'|'right'|'before'|'after'
- `reorderRow(srcIdx, destIdx)` — move an entire row (for Advanced mode)

**State is singleton:** Uses module-level refs so all components share the same editing/drag state.

### 2. `src/components/dashboard/DashboardView.vue` (MODIFIED)
**Changes:**
- Imported `useDashboardEdit` composable
- Replaced single settings gear button with a flex container holding two buttons:
  - **Edit mode active:** Green check button (exits edit mode)
  - **Normal mode:** Pencil button (enters edit mode) + Settings gear button
- Added `Escape` key handler to exit edit mode
- Settings shortcut (Ctrl+,) disabled while editing to prevent conflicts
- `isEditing` passed as prop to both `DashboardStandard` and `DashboardAdvanced`
- `exitEdit()` called on unmount to clean up

### 3. `src/components/dashboard/WidgetWrapper.vue` (MODIFIED)
**Changes:**
- Added `editing` prop (Boolean, default false) and `rowIdx` prop (Number)
- When `editing=true`: container gets `ring-2 ring-dashed ring-accent/30 rounded-2xl` highlight
- Shows floating drag handle badge (centered above widget) with grip icon + widget label
- `draggable` attribute set when editing
- `dragstart` handler calls `startDrag(widgetId, rowIdx)`, sets transfer data
- `dragend` handler calls `endDrag()`
- When actively being dragged: `opacity-30 scale-95` visual feedback
- Added smooth CSS transitions for drag state changes
- All Session B opacity functionality preserved unchanged

### 4. `src/components/dashboard/DashboardStandard.vue` (MODIFIED)
**Changes:**
- Added `isEditing` prop
- Imported `useDashboardEdit` for `handleDrop` and `dragWidgetId`
- Added drop zone state management: `activeDropZone` ref, helper functions
- **Drop zones appear when dragging:**
  - **Between rows:** Horizontal drop zones with dashed border, "+" icon. Drop inserts widget as new full-width row.
  - **Beside single-widget rows:** Left/right side drop zones (visible on `lg+` screens only). Drop creates a 2-col pair.
  - **After last row:** Final drop zone with "Drop here" label.
- Drop zones show active state (accent-colored border + subtle background) on dragover
- Edit mode banner at top: "Drag widgets to rearrange. Drop beside a widget to pair them."
- All `WidgetWrapper` instances now receive `:editing="isEditing"` and `:row-idx="rowIdx"` props
- Added scoped CSS for drop zone styling (idle, hover, active states)

### 5. `src/components/dashboard/DashboardAdvanced.vue` (MODIFIED)
**Changes:**
- Added `isEditing` prop
- Introduced section ordering system:
  - `DEFAULT_SECTION_ORDER`: 8 section IDs (gauges, infobar, disk-signals, swarm-alerts, favorites, core, user-apps, quick-links)
  - `SECTION_LABELS`: Human-readable labels for each section
  - `sectionOrder` computed reads from `raw.advanced_section_order` config, falls back to defaults
  - `sectionVisibility` computed maps each section ID to its visibility toggle
  - `visibleSections` computed: ordered + filtered list
- Sections now render via `v-for` over `visibleSections` with a switch template (previously hardcoded order)
- When editing: each section gets dashed ring border + floating drag handle badge
- Section-level HTML5 DnD: `dragstart`/`dragover`/`dragleave`/`drop` handlers on each section wrapper
- Drop reorders the section array and persists via `updateConfig('advanced_section_order', order)`
- Visual feedback: dragged section gets `opacity-30`, drag-over target gets accent highlight

## Schema Changes

```javascript
// No changes to grid_layout or widget_opacity

// New config key for Advanced mode:
advanced_section_order: [
  'gauges', 'infobar', 'disk-signals', 'swarm-alerts',
  'favorites', 'core', 'user-apps', 'quick-links'
]
```

## How Drag-and-Drop Works

### Standard Mode (full grid DnD)
1. User clicks pencil → `isEditing = true`
2. All widgets show drag handle badges + dashed ring borders
3. User starts dragging a widget → `dragWidgetId` set, widget fades to 30% opacity
4. Drop zones appear between rows and beside single-widget rows
5. Drop zones highlight on dragover (accent color)
6. On drop:
   - `handleDrop()` clones current `gridLayout`
   - Removes widget from source row (removes empty rows)
   - Inserts widget at target position:
     - `before`/`after`: new single-widget row
     - `left`/`right`: merge into existing row (max 2 per row; overflow creates new row)
   - Calls `updateGridLayout()` to persist
7. User clicks check → `isEditing = false`

### Advanced Mode (section reorder DnD)
1. Same pencil toggle activates edit mode
2. Entire sections (gauges, info bar, etc.) become draggable
3. Dragging a section over another section highlights the target
4. On drop: sections swap positions in the order array
5. New order persisted via `updateConfig('advanced_section_order', order)`
6. No 2-col pairing — Advanced layout stays fixed-position per design

### Keyboard
- `Escape` exits edit mode from anywhere
- `Ctrl+,` opens settings only when not in edit mode

## Backward Compatibility

- No new dependencies — uses native HTML5 Drag and Drop API
- `isEditing` defaults to `false` — all components render identically to pre-Session C when not editing
- `advanced_section_order` absent → falls back to `DEFAULT_SECTION_ORDER` (same as previous hardcoded order)
- All Session A (grid layout) and Session B (opacity) functionality fully preserved
- WidgetWrapper maintains all existing CSS custom property and scoped style behavior

## Deployment

```
session-c/composables/useDashboardEdit.js               → src/composables/useDashboardEdit.js (NEW)
session-c/components/dashboard/DashboardView.vue         → src/components/dashboard/DashboardView.vue
session-c/components/dashboard/WidgetWrapper.vue         → src/components/dashboard/WidgetWrapper.vue
session-c/components/dashboard/DashboardStandard.vue     → src/components/dashboard/DashboardStandard.vue
session-c/components/dashboard/DashboardAdvanced.vue     → src/components/dashboard/DashboardAdvanced.vue
```

Push to main → GitLab CI/CD auto-deploys to Pi.

## Verification

- [ ] Pencil icon appears next to settings gear in normal mode
- [ ] Click pencil → widgets show dashed borders + drag handles
- [ ] Settings gear hidden during edit mode; check button shown instead
- [ ] Drag clock next to SystemVitals → they pair in a 2-col row
- [ ] Drag network out of vitals+network pair → becomes its own full-width row
- [ ] Drop between rows creates a new row at that position
- [ ] Drop on bottom "Drop here" zone appends to end
- [ ] Layout persists after page reload
- [ ] Escape key exits edit mode
- [ ] Ctrl+, still opens settings in normal mode
- [ ] Advanced mode: sections can be dragged and reordered
- [ ] Advanced mode: section order persists across reloads
- [ ] All Session A grid layout features still work
- [ ] All Session B opacity features still work
- [ ] Mobile: side drop zones hidden (only row-level drops)

## Known Limitations

- **Touch devices:** HTML5 Drag and Drop API has limited touch support. Most mobile browsers don't fire drag events for touch. The settings modal (Session A) still provides full layout control as a fallback. If touch drag becomes a priority, `SortableJS` (~8KB gzipped) can be added later.
- **Side drop zones:** Only visible on `lg+` screens to avoid crowding on mobile.
- **Advanced mode:** Only section-level reorder, no per-widget or 2-col pairing (by design).
