// ParameterDrawer.ts: Modern parameter panel UI implementation

import { PARAMETER_SCHEMA, ParameterMeta } from '../config';
import { StateManager } from '../infrastructure/StateManager';
import { EventBus } from '../infrastructure/EventBus';

export class ParameterDrawer {
  private container: HTMLElement;
  private groupElements: Record<string, HTMLElement> = {};
  private searchInput: HTMLInputElement | null = null;
  private showAdvanced: boolean = false;
  private pinnedKeys: Set<string> = new Set();
  private statusEl: HTMLElement | null = null;
  private simPaused: boolean = false;
  private ariaLive: HTMLElement | null = null;
  private simState: StateManager<any>;
  private eventBus: EventBus;
  private state: any;
  private groupOrder: string[] = [];

  private structuralKeys = [
    'desiredCellSpacing', 'desiredNumCols', 'desiredNumRows', 'margin', 'defaultParams',
    // Add more keys if needed
  ];
  private pendingRestart: boolean = false;

  constructor(container: HTMLElement, simState: StateManager<any>, eventBus: EventBus) {
    this.container = container;
    this.simState = simState;
    this.eventBus = eventBus;
    this.state = simState.get();

    // Clear container and build skeleton markup
    this.container.innerHTML = '';

    // Header
    const header = document.createElement('header');
    header.className = 'drawer-header';
    header.setAttribute('role', 'banner');
    header.innerHTML = `
      <div class="drawer-logo" aria-label="App Name">PhysicsEngine2D</div>
      <div class="drawer-controls">
        <button id="pause-btn" aria-label="Pause or Resume Simulation"><span class="material-icons">pause</span></button>
        <button id="reset-btn" aria-label="Reset Simulation"><span class="material-icons">restart_alt</span></button>
        <select id="preset-select" aria-label="Presets">
          <option value="recommended">Recommended</option>
          <option value="realistic">Realistic</option>
          <option value="extreme">Extreme</option>
          <option value="custom">Custom</option>
        </select>
        <span id="sim-status" class="sim-status" aria-live="polite">Running</span>
      </div>
    `;
    this.container.appendChild(header);

    // Search bar and advanced toggle
    const searchRow = document.createElement('div');
    searchRow.style.display = 'flex';
    searchRow.style.alignItems = 'center';
    searchRow.style.gap = '10px';
    searchRow.innerHTML = `
      <input id="parameter-search" class="parameter-search" type="search" placeholder="Search parameters..." aria-label="Search parameters" />
      <button id="toggle-advanced-btn" aria-pressed="false" aria-label="Show Advanced Parameters"><span class="material-icons">tune</span></button>
      <span id="toggle-advanced-label" style="font-size:0.98em; color:#1976d2; margin-left:2px;">Show Advanced</span>
    `;
    this.container.appendChild(searchRow);

    // ARIA live region for announcements
    this.renderAriaLive();

    // Parameter groups section
    this.ensureParameterGroupsSection();

    // Footer
    const footer = document.createElement('footer');
    footer.className = 'drawer-footer';
    footer.setAttribute('role', 'contentinfo');
    footer.innerHTML = `
      <button id="add-mask-btn" aria-label="Add Mask Region"><span class="material-icons">add_box</span> Add Mask</button>
      <button id="restore-defaults-btn" aria-label="Restore Defaults"><span class="material-icons">settings_backup_restore</span> Defaults</button>
      <button id="undo-btn" aria-label="Undo"><span class="material-icons">undo</span></button>
      <button id="redo-btn" aria-label="Redo"><span class="material-icons">redo</span></button>
    `;
    this.container.appendChild(footer);

    // Banner for restart-required
    const restartBanner = document.createElement('div');
    restartBanner.id = 'restart-banner';
    restartBanner.style.display = 'none';
    restartBanner.style.background = '#fffbe6';
    restartBanner.style.color = '#b26a00';
    restartBanner.style.padding = '10px 16px';
    restartBanner.style.borderTop = '1px solid #ffe082';
    restartBanner.style.justifyContent = 'space-between';
    restartBanner.style.alignItems = 'center';
    restartBanner.style.display = 'flex';
    restartBanner.innerHTML = `
      <span>Some changes require a simulation restart.</span>
      <button id="restart-sim-btn" style="background:#ffd54f; color:#333; border:none; border-radius:4px; padding:6px 14px; font-weight:500; cursor:pointer;">Restart Now</button>
    `;
    this.container.appendChild(restartBanner);

    // Continue with logic
    this.initGroupOrder();
    this.renderGroups();
    this.attachHeaderListeners();
    this.attachFooterListeners();
    this.attachSearchListener();
    this.attachKeyboardShortcuts();
    this.attachAdvancedToggle();
    this.updateStatus('Running');
    // Subscribe to state changes
    this.simState.subscribe((s) => {
      this.state = s;
      this.renderGroups();
    });
    this.attachRestartBannerListener();
  }

  // Ensure the parameter-groups section exists for rendering controls
  private ensureParameterGroupsSection() {
    let groupsRoot = this.container.querySelector('#parameter-groups');
    if (!groupsRoot) {
      groupsRoot = document.createElement('section');
      groupsRoot.id = 'parameter-groups';
      groupsRoot.className = 'parameter-groups';
      groupsRoot.setAttribute('aria-label', 'Parameter Groups');
      this.container.appendChild(groupsRoot);
    }
  }

  private initGroupOrder() {
    // Initialize group order from schema
    const groupSet = new Set<string>();
    for (const meta of Object.values(PARAMETER_SCHEMA)) {
      groupSet.add(meta.group);
    }
    this.groupOrder = Array.from(groupSet);
  // (removed duplicate renderAriaLive)
  }

  private renderAriaLive() {
    // For screen reader announcements
    let ariaLive = this.container.querySelector('#parameter-aria-live') as HTMLElement | null;
    if (!ariaLive) {
      ariaLive = document.createElement('div');
      ariaLive.id = 'parameter-aria-live';
      ariaLive.setAttribute('aria-live', 'polite');
      ariaLive.style.position = 'absolute';
      ariaLive.style.left = '-9999px';
      this.container.appendChild(ariaLive);
    }
    this.ariaLive = ariaLive;
  }

  private renderGroups() {
    const groupMap = new Map<string, Array<[string, ParameterMeta]>>();
    for (const [key, meta] of Object.entries(PARAMETER_SCHEMA)) {
      if (this.showAdvanced || !meta.advanced) {
        if (!groupMap.has(meta.group)) groupMap.set(meta.group, []);
        groupMap.get(meta.group)!.push([key, meta]);
      }
    }
    const groupsRoot = this.container.querySelector('#parameter-groups');
    if (!groupsRoot) return;
    groupsRoot.innerHTML = '';

    // Pinned controls group
    if (this.pinnedKeys.size > 0) {
      const pinnedEl = document.createElement('section');
      pinnedEl.className = 'parameter-group';
      pinnedEl.setAttribute('data-group', 'Pinned');
      const header = document.createElement('div');
      header.className = 'parameter-group-header';
      header.tabIndex = 0;
      header.innerHTML = `<span class="material-icons">star</span><span>Pinned</span>`;
      pinnedEl.appendChild(header);
      const controls = document.createElement('div');
      controls.className = 'parameter-controls';
      for (const key of this.pinnedKeys) {
        const meta = PARAMETER_SCHEMA[key];
        if (meta) controls.appendChild(this.createControl(key, meta, true));
      }
      pinnedEl.appendChild(controls);
      groupsRoot.appendChild(pinnedEl);
    }

    // Render groups in custom order
    for (const group of this.groupOrder) {
      const params = groupMap.get(group);
      if (!params) continue;
      const groupEl = document.createElement('section');
      groupEl.className = 'parameter-group';
      groupEl.setAttribute('data-group', group);
      // Header (draggable)
      const header = document.createElement('div');
      header.className = 'parameter-group-header';
      header.tabIndex = 0;
      header.innerHTML = `<span class="material-icons">settings</span><span>${group}</span>`;
      header.setAttribute('role', 'button');
      header.setAttribute('aria-expanded', 'true');
      header.draggable = true;
      header.addEventListener('click', () => {
        groupEl.classList.toggle('collapsed');
        header.setAttribute('aria-expanded', (!groupEl.classList.contains('collapsed')).toString());
      });
      // Drag events
      header.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', group);
        header.classList.add('dragging');
      });
      header.addEventListener('dragend', () => {
        header.classList.remove('dragging');
      });
      groupEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        groupEl.classList.add('drag-over');
      });
      groupEl.addEventListener('dragleave', () => {
        groupEl.classList.remove('drag-over');
      });
      groupEl.addEventListener('drop', (e) => {
        e.preventDefault();
        groupEl.classList.remove('drag-over');
        const fromGroup = e.dataTransfer?.getData('text/plain');
        if (fromGroup && fromGroup !== group) {
          const fromIdx = this.groupOrder.indexOf(fromGroup);
          const toIdx = this.groupOrder.indexOf(group);
          if (fromIdx !== -1 && toIdx !== -1) {
            this.groupOrder.splice(toIdx, 0, this.groupOrder.splice(fromIdx, 1)[0]);
            this.renderGroups();
          }
        }
      });
      groupEl.appendChild(header);
      // Controls
      const controls = document.createElement('div');
      controls.className = 'parameter-controls';
      for (const [key, meta] of params) {
        controls.appendChild(this.createControl(key, meta));
      }
      groupEl.appendChild(controls);
      groupsRoot.appendChild(groupEl);
      this.groupElements[group] = groupEl;
    }
  }
  private attachAdvancedToggle() {
    const btn = this.container.querySelector('#toggle-advanced-btn') as HTMLButtonElement | null;
    const label = this.container.querySelector('#toggle-advanced-label') as HTMLElement | null;
    if (btn && label) {
      btn.onclick = () => {
        this.showAdvanced = !this.showAdvanced;
        label.textContent = this.showAdvanced ? 'Hide Advanced' : 'Show Advanced';
        this.renderGroups();
      };
      label.textContent = this.showAdvanced ? 'Hide Advanced' : 'Show Advanced';
    }
  }

  private showRestartBanner(show: boolean) {
    const banner = this.container.querySelector('#restart-banner') as HTMLElement | null;
    if (banner) banner.style.display = show ? 'flex' : 'none';
  }

  private triggerRestart() {
    this.pendingRestart = false;
    this.showRestartBanner(false);
    (window as any).resetSimulationWithParams?.(this.simState.get());
  }

  private createControl(key: string, meta: ParameterMeta, isPinned = false): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'parameter-control';
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', meta.label);
    // Label row
    const label = document.createElement('div');
    label.className = 'control-label';
    label.innerHTML = `<span class="material-icons">${meta.icon || 'tune'}</span><span>${meta.label}</span>`;
    if (meta.unit) {
      const unit = document.createElement('span');
      unit.className = 'control-unit';
      unit.textContent = `(${meta.unit})`;
      label.appendChild(unit);
    }
    // Pin button
    const pinBtn = document.createElement('button');
    pinBtn.className = 'pin-btn';
    pinBtn.title = isPinned ? 'Unpin' : 'Pin to top';
    pinBtn.innerHTML = `<span class="material-icons">${isPinned ? 'star' : 'star_border'}</span>`;
    pinBtn.onclick = (e) => {
      e.preventDefault();
      if (this.pinnedKeys.has(key)) this.pinnedKeys.delete(key);
      else this.pinnedKeys.add(key);
      this.renderGroups();
    };
    label.appendChild(pinBtn);
    wrapper.appendChild(label);
    // Control input (wired to state)
    let input: HTMLElement;
    let valueEl: HTMLElement | null = null;
    const stateValue = this.state[key];
    const isStructural = this.structuralKeys.includes(key);
    switch (meta.type) {
      case 'slider': {
        const slider = document.createElement('input');
        slider.setAttribute('type', 'range');
        slider.setAttribute('min', String(meta.min ?? 0));
        slider.setAttribute('max', String(meta.max ?? 100));
        slider.setAttribute('step', String(meta.step ?? 1));
        slider.classList.add('control-input', 'mui-slider');
        slider.value = stateValue !== undefined ? String(stateValue) : String(meta.min ?? 0);
        valueEl = document.createElement('span');
        valueEl.className = 'control-value';
        valueEl.textContent = slider.value;
        slider.oninput = (e) => {
          const v = (e.target as HTMLInputElement).value;
          valueEl!.textContent = v;
          if (isStructural) {
            this.simState.set({ [key]: parseFloat(v) });
            this.pendingRestart = true;
            this.showRestartBanner(true);
          } else {
            this.simState.set({ [key]: parseFloat(v) });
            this.eventBus.emit('parameterChange', { [key]: parseFloat(v) });
          }
        };
        input = document.createElement('div');
        input.appendChild(slider);
        input.appendChild(valueEl);
        break;
      }
      case 'toggle': {
        const checkbox = document.createElement('input');
        checkbox.setAttribute('type', 'checkbox');
        checkbox.classList.add('control-input');
        checkbox.checked = !!stateValue;
        checkbox.onchange = (e) => {
          const v = (e.target as HTMLInputElement).checked;
          if (isStructural) {
            this.simState.set({ [key]: v });
            this.pendingRestart = true;
            this.showRestartBanner(true);
          } else {
            this.simState.set({ [key]: v });
            this.eventBus.emit('parameterChange', { [key]: v });
          }
        };
        input = checkbox;
        break;
      }
      case 'select': {
        const select = document.createElement('select');
        (meta.options || []).forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          select.appendChild(option);
        });
        select.classList.add('control-input');
        select.value = stateValue !== undefined ? String(stateValue) : (meta.options?.[0]?.value ?? '');
        select.onchange = (e) => {
          const v = (e.target as HTMLSelectElement).value;
          if (isStructural) {
            this.simState.set({ [key]: v });
            this.pendingRestart = true;
            this.showRestartBanner(true);
          } else {
            this.simState.set({ [key]: v });
            this.eventBus.emit('parameterChange', { [key]: v });
          }
        };
        input = select;
        break;
      }
      case 'vector2': {
        input = document.createElement('div');
        input.classList.add('control-input');
        const x = document.createElement('input');
        x.type = 'number';
        x.step = String(meta.step ?? 0.1);
        x.className = 'vector2-x';
        x.style.width = '60px';
        const y = document.createElement('input');
        y.type = 'number';
        y.step = String(meta.step ?? 0.1);
        y.className = 'vector2-y';
        y.style.width = '60px';
        x.value = stateValue?.x !== undefined ? String(stateValue.x) : '0';
        y.value = stateValue?.y !== undefined ? String(stateValue.y) : '0';
        x.oninput = () => {
          if (isStructural) {
            this.simState.set({ [key]: { x: parseFloat(x.value), y: parseFloat(y.value) } });
            this.pendingRestart = true;
            this.showRestartBanner(true);
          } else {
            this.simState.set({ [key]: { x: parseFloat(x.value), y: parseFloat(y.value) } });
            this.eventBus.emit('parameterChange', { [key]: { x: parseFloat(x.value), y: parseFloat(y.value) } });
          }
        };
        y.oninput = x.oninput;
        input.appendChild(x);
        input.appendChild(document.createTextNode(' X '));
        input.appendChild(y);
        input.appendChild(document.createTextNode(' Y'));
        break;
      }
      default: {
        const text = document.createElement('input');
        text.setAttribute('type', 'text');
        text.classList.add('control-input');
        text.value = stateValue !== undefined ? String(stateValue) : '';
        text.oninput = (e) => {
          const v = (e.target as HTMLInputElement).value;
          if (isStructural) {
            this.simState.set({ [key]: v });
            this.pendingRestart = true;
            this.showRestartBanner(true);
          } else {
            this.simState.set({ [key]: v });
            this.eventBus.emit('parameterChange', { [key]: v });
          }
        };
        input = text;
      }
    }
    wrapper.appendChild(input);
    // Help/explanation
    if (meta.description) {
      const help = document.createElement('div');
      help.className = 'control-help';
      help.textContent = meta.description;
      wrapper.appendChild(help);
    }
    // Advanced badge
    if (meta.advanced) {
      const adv = document.createElement('span');
      adv.className = 'advanced-badge';
      adv.textContent = 'Advanced';
      wrapper.appendChild(adv);
    }
    return wrapper;
  }

  private attachHeaderListeners() {
    // Pause/Resume
    const pauseBtn = this.container.querySelector('#pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        this.eventBus.emit('ui:togglePause', undefined);
      });
    }
    // Reset
    const resetBtn = this.container.querySelector('#reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.eventBus.emit('ui:reset', undefined);
      });
    }
    // Presets
    const presetSelect = this.container.querySelector('#preset-select') as HTMLSelectElement | null;
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        this.announce(`Preset selected: ${(e.target as HTMLSelectElement).value}`);
        // TODO: Wire to preset logic
      });
    }
    // Status
    this.statusEl = this.container.querySelector('#sim-status') as HTMLElement | null;
  }

  private attachFooterListeners() {
    // Add Mask
    const addMaskBtn = this.container.querySelector('#add-mask-btn');
    if (addMaskBtn) {
      addMaskBtn.addEventListener('click', () => {
        this.announce('Add Mask Region (not yet implemented)');
      });
    }
    // Restore Defaults
    const restoreBtn = this.container.querySelector('#restore-defaults-btn');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', () => {
        this.announce('Restore Defaults (not yet implemented)');
      });
    }
    // Undo/Redo
    const undoBtn = this.container.querySelector('#undo-btn');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        this.announce('Undo (not yet implemented)');
      });
    }
    const redoBtn = this.container.querySelector('#redo-btn');
    if (redoBtn) {
      redoBtn.addEventListener('click', () => {
        this.announce('Redo (not yet implemented)');
      });
    }
  }

  private attachSearchListener() {
    this.searchInput = this.container.querySelector('#parameter-search') as HTMLInputElement | null;
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => {
        this.filterParameters(this.searchInput!.value);
      });
    }
  }

  private filterParameters(query: string) {
    query = query.trim().toLowerCase();
    if (!query) {
      this.renderGroups();
      return;
    }
    const groupsRoot = this.container.querySelector('#parameter-groups');
    if (!groupsRoot) return;
    groupsRoot.innerHTML = '';
    for (const [key, meta] of Object.entries(PARAMETER_SCHEMA)) {
      if ((meta.label.toLowerCase().includes(query) || meta.description.toLowerCase().includes(query)) && (this.showAdvanced || !meta.advanced)) {
        groupsRoot.appendChild(this.createControl(key, meta));
      }
    }
  }

  private attachKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' || e.code === 'Space') {
        // Space: Pause/Resume
        e.preventDefault();
        const pauseBtn = this.container.querySelector('#pause-btn') as HTMLElement | null;
        pauseBtn?.click();
      } else if (e.key === 'r' || e.key === 'R') {
        // R: Reset
        e.preventDefault();
        const resetBtn = this.container.querySelector('#reset-btn') as HTMLElement | null;
        resetBtn?.click();
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        // /: Focus search
        e.preventDefault();
        this.searchInput?.focus();
      }
    });
  }

  private updateStatus(status: string) {
    if (this.statusEl) {
      this.statusEl.textContent = status;
      this.statusEl.className = 'sim-status sim-status-' + status.toLowerCase();
    }
  }

  private announce(msg: string) {
    if (this.ariaLive) {
      this.ariaLive.textContent = msg;
    }
  }

  // Add event listener for restart button after DOM is ready
  private attachRestartBannerListener() {
    const btn = this.container.querySelector('#restart-sim-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.onclick = () => this.triggerRestart();
    }
  }
}
