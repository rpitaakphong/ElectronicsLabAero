/* Divider profile driver for the shared breadboard editor. */
(function (root) {
  'use strict';
  const names = {
    blank: 'Blank board',
    basic: 'Basic divider',
    loaded: 'Loaded divider',
    potentiometer: 'Potentiometer',
    sensor: 'Sensor divider',
  };
  const descriptions = {
    basic:
      'Vout = Vin × R2 / (R1 + R2). Start with equal resistors, then change R2. Increase both resistors together to keep the voltage ratio but reduce current.',
    loaded:
      'RL is in parallel with R2. Vout = Vin × (R2 ∥ RL) / (R1 + R2 ∥ RL). Compare the output before and after connecting a load.',
    potentiometer:
      'A is the supply end, B is the return end, and W is the wiper. Position runs from 0% at B to 100% at A. Add a resistor from W to B to explore loading.',
    sensor:
      'Adjust the sensor resistance directly. A sensor below Vout makes output rise as resistance increases. Rewire it above Vout to reverse the response.',
  };
  function schematic(kind) {
    const pot = kind === 'potentiometer',
      loaded = kind === 'loaded',
      sensor = kind === 'sensor';
    const resistor = (x, y, label) =>
      `<g transform="translate(${x} ${y})"><path d="M0 -40V-28H-12V28H12V-28H0M0 28V40"/><text x="25" y="5">${label}</text></g>`;
    return `<svg viewBox="0 0 720 280" class="divider-reference" role="img" aria-label="${names[kind]} reference schematic"><g fill="none" stroke="currentColor" stroke-width="2.5"><path d="M110 80V35H310V60M110 160V245H310V220"/><circle cx="110" cy="120" r="40"/><path d="M95 105H125M110 90V120M95 140H125"/>${pot ? '<path d="M310 60V75H298V205H322V75H310M310 205V220M450 140H322M335 130L322 140L335 150"/>' : resistor(310, 100, 'R1 · 10 kΩ') + resistor(310, 180, sensor ? 'Sensor · 10 kΩ' : 'R2 · 10 kΩ')}<path d="M${pot ? '450' : '310'} 140H550M310 245H550"/>${loaded ? '<path d="M510 140V145M510 225V245"/>' + resistor(510, 185, 'RL · 10 kΩ') : ''}<circle cx="550" cy="140" r="5"/><circle cx="550" cy="245" r="5"/></g><g fill="currentColor" font-family="Inter,system-ui" font-size="16"><text x="35" y="205">Vin · 5 V DC</text><text x="567" y="145">Vout / red</text><text x="567" y="250">Return / black</text>${pot ? '<text x="330" y="65">A</text><text x="330" y="225">B</text><text x="390" y="125">W · 50%</text><text x="220" y="150">10 kΩ</text>' : ''}</g></svg>`;
  }
  function create(api) {
    const {
      state,
      profile,
      fmt,
      engParse,
      toast,
      boardSnapshot,
      prepareLayout,
      clone,
      setTool,
      setLead,
      putEnd,
      nodeFor,
      terminalKeys,
      cancelGesture,
      refreshBoard,
      history,
      isEditing,
    } = api;
    const $ = (id) => document.getElementById(id),
      prefix = profile.storage;
    let unlocked = false,
      custom = [];
    const storageKey = (id) => `${prefix}-${id}`;
    const validNode = (n) =>
      ['VPLUS', 'GND_TOP', 'GND_BOTTOM', 'VMINUS'].includes(n) ||
      /^[TB]:([1-9]|[12][0-9]|30)$/.test(n);
    const validHole = (h) =>
      h &&
      ['VPLUS', 'GND_TOP', 'GND_BOTTOM', 'VMINUS', ...'ABCDEFGHIJ'].includes(
        h.row,
      ) &&
      Number.isInteger(h.col) &&
      h.col >= 1 &&
      h.col <= 30;
    const leadKeys = Object.keys(profile.leads);
    const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
    function validate(saved) {
      if (
        !object(saved) ||
        saved.lab !== profile.id ||
        saved.version !== 1 ||
        !object(saved.state)
      )
        throw new Error('Unsupported divider save.');
      const input = clone(saved.state);
      const b = {
        components: input.components,
        leads: input.leads,
        leadHoles: input.leadHoles,
        supply: input.supply,
        meter: input.meter,
      };
      if (
        !Array.isArray(b.components) ||
        !object(b.leads) ||
        !object(b.leadHoles) ||
        !object(b.supply) ||
        !object(b.meter) ||
        !['voltage', 'current', 'resistance'].includes(b.meter.mode) ||
        typeof b.supply.enabled !== 'boolean' ||
        !Number.isFinite(b.supply.voltage) ||
        b.supply.voltage < 0 ||
        b.supply.voltage > 24
      )
        throw new Error('Invalid instrument settings.');
      const ids = new Set();
      for (const c of b.components) {
        if (
          !object(c) ||
          typeof c.id !== 'string' ||
          !/^[A-Za-z][A-Za-z0-9]*$/.test(c.id) ||
          leadKeys.includes(c.id) ||
          ids.has(c.id) ||
          !['wire', 'resistor', 'potentiometer'].includes(c.type)
        )
          throw new Error('Invalid component.');
        ids.add(c.id);
        if (
          c.type !== 'wire' &&
          (!Number.isFinite(c.value) || c.value < 100 || c.value > 1e6)
        )
          throw new Error('Resistance must be 100 Ω–1 MΩ.');
        if (
          c.variant != null &&
          (c.type !== 'resistor' || c.variant !== 'sensor')
        )
          throw new Error('Invalid sensor.');
        if (
          c.type === 'wire' &&
          c.color != null &&
          !/^#[0-9a-f]{6}$/i.test(c.color)
        )
          throw new Error('Invalid wire color.');
        if (
          c.type === 'potentiometer' &&
          (!Number.isFinite(c.position) || c.position < 0 || c.position > 1)
        )
          throw new Error('Invalid wiper position.');
        for (const end of terminalKeys(c))
          if (
            !validNode(c[end]) ||
            !validHole(c[end + 'Hole']) ||
            nodeFor(c[end + 'Hole'].row, c[end + 'Hole'].col) !== c[end]
          )
            throw new Error('Invalid component terminal.');
      }
      if (
        Object.keys(b.leads).some((k) => !leadKeys.includes(k)) ||
        Object.keys(b.leadHoles).some((k) => !leadKeys.includes(k))
      )
        throw new Error('Invalid instrument lead.');
      for (const key of leadKeys) {
        if (
          b.leads[key] != null &&
          (!validNode(b.leads[key]) ||
            !validHole(b.leadHoles[key]) ||
            nodeFor(b.leadHoles[key].row, b.leadHoles[key].col) !==
              b.leads[key])
        )
          throw new Error('Invalid probe position.');
        if (b.leads[key] == null && b.leadHoles[key] != null)
          throw new Error('Disconnected lead has a stored hole.');
      }
      return prepareLayout(b).board;
    }
    const snapshot = () => ({
      lab: profile.id,
      version: 1,
      state: JSON.parse(boardSnapshot()),
    });
    const canSave = () => {
      if (isEditing()) {
        toast('Finish or cancel the current placement before saving.');
        return false;
      }
      return true;
    };
    function read(key) {
      try {
        const s = localStorage.getItem(storageKey(key));
        return s ? JSON.parse(s) : null;
      } catch {
        toast('Saved data could not be read. Current circuit is unchanged.');
        return null;
      }
    }
    function write(key, value) {
      try {
        localStorage.setItem(storageKey(key), JSON.stringify(value));
        return true;
      } catch {
        toast(
          'Browser storage is unavailable or full. Current circuit is still open.',
        );
        return false;
      }
    }
    function restore(saved) {
      try {
        const b = validate(saved);
        cancelGesture();
        Object.assign(state, b);
        state.selectedId = null;
        update();
        syncInputs();
        toast('Lab recalled. Undo restores your previous circuit.');
        return true;
      } catch (e) {
        toast(
          `Cannot load lab: ${e.message} Current circuit is unchanged.`,
          4500,
        );
        return false;
      }
    }
    function blank() {
      return {
        components: [],
        leads: {},
        leadHoles: {},
        supply: { voltage: 5, enabled: false },
        meter: { mode: 'voltage' },
      };
    }
    function builtin(kind) {
      const b = blank();
      if (kind === 'blank') return b;
      let id = 0;
      const h = (address) => {
        const [row, col] = address.split(':');
        return { row, col: Number(col) };
      };
      const part = (type, a, bh, value, extra = {}) => {
        const c = {
          id:
            (type === 'wire' ? 'W' : type === 'potentiometer' ? 'P' : 'R') +
            ++id,
          type,
          ...extra,
        };
        putEnd(c, 'a', h(a));
        putEnd(c, 'b', h(bh));
        if (type === 'wire') c.color = '#48a26a';
        else c.value = value;
        b.components.push(c);
        return c;
      };
      part('wire', 'VPLUS:6', 'E:6');
      part('wire', 'GND_TOP:20', 'D:20');
      if (kind === 'potentiometer') {
        const c = part('potentiometer', 'A:6', 'A:20', 10000, {
          position: 0.5,
        });
        putEnd(c, 'w', h('C:12'));
      } else {
        part('resistor', 'A:6', 'A:12', 10000);
        part(
          'resistor',
          'C:12',
          'C:20',
          10000,
          kind === 'sensor' ? { variant: 'sensor' } : {},
        );
        if (kind === 'loaded') part('resistor', 'E:12', 'E:20', 10000);
      }
      for (const [key, address] of Object.entries({
        supplyPositive: 'VPLUS:2',
        supplyNegative: 'GND_TOP:2',
        meterRed: 'B:12',
        meterBlack: 'B:20',
      })) {
        const hole = h(address);
        b.leadHoles[key] = hole;
        b.leads[key] = nodeFor(hole.row, hole.col);
      }
      b.supply.enabled = true;
      return b;
    }
    function refreshPresets() {
      const select = $('presetSelect'),
        selected = select.value || 'blank';
      select.replaceChildren();
      for (const [value, label] of [
        ...Object.entries(names),
        ...custom.map((c) => [c.id, c.name]),
      ]) {
        const option = new Option(label, value);
        option.disabled = value !== 'blank' && !unlocked;
        select.add(option);
      }
      select.value = [...select.options].some((o) => o.value === selected)
        ? selected
        : 'blank';
      $('presetAccess').hidden = unlocked;
      document.querySelector('.preset-manager').hidden = !unlocked;
      $('presetAccessStatus').textContent = unlocked
        ? 'Presets unlocked for this visit. Loading a preset replaces the board.'
        : 'Presets are locked. Build your circuit on the blank board.';
      $('restorePresetBtn').textContent = custom.some(
        (c) => c.id === select.value,
      )
        ? 'Delete preset'
        : 'Restore original';
    }
    function load(kind, original = false) {
      if (!Object.hasOwn(names, kind) && !custom.some((c) => c.id === kind))
        return;
      if (kind !== 'blank' && !unlocked) {
        toast('Unlock presets first.');
        return;
      }
      if (!original && unlocked) {
        const saved = read('preset-' + kind);
        if (saved) {
          restore(saved);
          return;
        }
        if (!Object.hasOwn(names, kind)) {
          toast('Saved preset is missing.');
          return;
        }
      }
      cancelGesture();
      Object.assign(state, builtin(kind));
      state.selectedId = null;
      $('presetSelect').value = kind;
      syncInputs();
      update();
    }
    function render() {
      const result = DCEngine.solve(state);
      state.sim.last = result;
      state.sim.error = result.status === 'fault' ? result.message : null;
      $('meterReading').textContent =
        result.status === 'ok'
          ? fmt(result.value, result.unit)
          : result.status === 'open'
            ? 'OL'
            : '—';
      $('meterReading').dataset.status = result.status;
      $('meterMessage').textContent = result.message;
      const warnings = [...result.warnings];
      if (result.status !== 'ok') warnings.push(result.message);
      const list = $('circuitWarnings');
      list.replaceChildren(
        ...warnings.map((text) => {
          const li = document.createElement('li');
          li.textContent = text;
          return li;
        }),
      );
      $('circuitStatus').textContent =
        result.status === 'fault'
          ? 'Check circuit connections'
          : result.status === 'ok'
            ? 'Measurement ready'
            : 'Check instrument connections';
      $('circuitStatus').className =
        'status-pill ' +
        (result.status === 'fault'
          ? 'bad'
          : result.status === 'ok'
            ? 'ok'
            : 'warn');
      $('dcSupplyStatus').textContent =
        `${state.supply.enabled ? 'Output on' : 'Output off'} · ${fmt(state.supply.voltage, 'V')} · ${state.leads.supplyPositive && state.leads.supplyNegative ? 'both leads connected' : 'connect both leads'}`;
    }
    function syncInputs() {
      $('dcVoltage').value = state.supply.voltage;
      $('dcOutput').checked = state.supply.enabled;
      $('meterMode').value = state.meter.mode;
    }
    function update() {
      refreshBoard();
      render();
    }
    function download(data) {
      const url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json',
          }),
        ),
        a = document.createElement('a');
      a.href = url;
      a.download = 'voltage-divider-presets.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function init() {
      const index = read('custom-presets');
      if (Array.isArray(index))
        custom = index.filter(
          (c) =>
            object(c) &&
            /^custom-[a-z0-9-]+$/.test(c.id) &&
            typeof c.name === 'string' &&
            c.name.trim() &&
            c.name.length <= 60,
        );
      refreshPresets();
      $('presetUnlockForm').onsubmit = (e) => {
        e.preventDefault();
        const input = $('presetPassword');
        if (input.value !== 'aero1234') {
          $('presetUnlockError').hidden = false;
          input.setAttribute('aria-invalid', 'true');
          return;
        }
        unlocked = true;
        input.value = '';
        input.removeAttribute('aria-invalid');
        $('presetUnlockError').hidden = true;
        refreshPresets();
        $('presetSelect').focus();
      };
      $('presetSelect').onchange = () => {
        if (!unlocked) $('presetSelect').value = 'blank';
        refreshPresets();
      };
      $('loadPresetBtn').onclick = () => load($('presetSelect').value);
      $('resetAllBtn').onclick = () => {
        load('blank', true);
        setTool('select');
      };
      $('saveLabBtn').onclick = () => {
        if (!canSave()) return;
        try {
          const data = snapshot();
          validate(data);
          if (write('lab', data))
            toast('Divider lab and exact connections saved.');
        } catch (e) {
          toast(e.message);
        }
      };
      $('recallLabBtn').onclick = () => {
        const saved = read('lab');
        if (saved) restore(saved);
        else toast('No saved divider lab found.');
      };
      $('savePresetBtn').onclick = () => {
        if (
          unlocked &&
          canSave() &&
          write('preset-' + $('presetSelect').value, snapshot())
        )
          toast('Current circuit saved over the selected preset.');
      };
      $('createPresetBtn').onclick = () => {
        if (!unlocked || !canSave()) return;
        const name = $('newPresetName').value.trim();
        if (
          !name ||
          name.length > 60 ||
          [...Object.values(names), ...custom.map((c) => c.name)].some(
            (n) => n.toLowerCase() === name.toLowerCase(),
          )
        )
          return toast('Choose a unique preset name, up to 60 characters.');
        const entry = { id: 'custom-' + crypto.randomUUID(), name };
        if (
          !write('preset-' + entry.id, snapshot()) ||
          !write('custom-presets', [...custom, entry])
        )
          return;
        custom.push(entry);
        refreshPresets();
        $('presetSelect').value = entry.id;
        $('newPresetName').value = '';
        toast('Custom divider preset created.');
      };
      $('restorePresetBtn').onclick = () => {
        if (!unlocked) return;
        const id = $('presetSelect').value;
        try {
          localStorage.removeItem(storageKey('preset-' + id));
          if (custom.some((c) => c.id === id)) {
            const next = custom.filter((c) => c.id !== id);
            if (!write('custom-presets', next)) return;
            custom = next;
            refreshPresets();
            toast('Preset deleted. Current circuit is unchanged.');
          } else load(id, true);
        } catch {
          toast('Browser storage is unavailable.');
        }
      };
      $('exportPresetsBtn').onclick = () => {
        if (!unlocked) return;
        const presets = {};
        for (const id of [...Object.keys(names), ...custom.map((c) => c.id)]) {
          const d = read('preset-' + id);
          if (d) presets[id] = d;
        }
        download({ lab: profile.id, version: 1, custom, presets });
      };
      $('dcVoltage').onchange = () => {
        const text = $('dcVoltage').value,
          v = engParse(text);
        if (!text.trim() || !Number.isFinite(v) || v < 0 || v > 24) {
          toast('Choose a supply voltage from 0 to 24 V.');
          syncInputs();
          return;
        }
        state.supply.voltage = v;
        update();
      };
      $('dcOutput').onchange = () => {
        state.supply.enabled = $('dcOutput').checked;
        update();
      };
      $('meterMode').onchange = () => {
        state.meter.mode = $('meterMode').value;
        update();
      };
      const reference = () => {
        $('schematicDiagram').innerHTML = schematic($('schematicSelect').value);
        $('schematicDescription').textContent =
          descriptions[$('schematicSelect').value];
      };
      $('schematicSelect').onchange = reference;
      reference();
      load('blank', true);
      setTool('select');
      history.past = [];
      history.future = [];
      refreshBoard();
    }
    return { init, render, update, syncInputs };
  }
  root.DividerRuntime = { create };
})(globalThis);
