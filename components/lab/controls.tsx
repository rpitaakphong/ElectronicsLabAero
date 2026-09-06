'use client';
import { useEffect, useId, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Source } from '@/lib/opamp/simulator';

export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="choice-field">
      <label id={id}>{label}</label>
      <Select
        value={value}
        items={options}
        onValueChange={(v) => {
          if (v !== null) onChange(v);
        }}
      >
        <SelectTrigger aria-labelledby={id} className="w-full h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function Field({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  scale = 1,
  log = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  scale?: number;
  log?: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId(),
    [draft, setDraft] = useState(
      String(Number((value / scale).toPrecision(6))),
    ),
    [error, setError] = useState('');
  useEffect(() => {
    setDraft(String(Number((value / scale).toPrecision(6))));
    setError('');
  }, [value, scale]);
  function change(text: string) {
    setDraft(text);
    const v = Number(text) * scale;
    if (text.trim() !== '' && Number.isFinite(v) && v >= min && v <= max) {
      setError('');
      onChange(v);
    } else setError(`Enter ${min / scale}–${max / scale} ${unit}.`);
  }
  const sliderValue = log ? Math.log10(value) : value / scale;
  return (
    <div className="parameter">
      <div className="parameter-top">
        <label htmlFor={id}>{label}</label>
        <div className="numeric-entry">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            value={draft}
            step={step}
            min={min / scale}
            max={max / scale}
            aria-invalid={!!error}
            aria-describedby={error ? id + '-error' : undefined}
            onChange={(e) => change(e.target.value)}
            onBlur={() => {
              if (error) {
                setDraft(String(Number((value / scale).toPrecision(6))));
                setError('');
              }
            }}
          />
          <span>{unit}</span>
        </div>
      </div>
      <Slider
        aria-label={label}
        aria-valuetext={`${Number((value / scale).toPrecision(6))} ${unit}`}
        value={[sliderValue]}
        min={log ? Math.log10(min) : min / scale}
        max={log ? Math.log10(max) : max / scale}
        step={log ? 0.005 : step}
        onValueChange={(v) => {
          const n = Array.isArray(v) ? v[0] : v;
          onChange(
            log
              ? Math.min(max, Math.max(min, Number((10 ** n).toPrecision(5))))
              : n * scale,
          );
        }}
      />
      {error && (
        <p id={id + '-error'} role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
export function SourceControls({
  source,
  onChange,
  label,
}: {
  source: Source;
  onChange: (source: Source) => void;
  label: string;
}) {
  const set = (key: keyof Source, value: number | string) =>
    onChange({ ...source, [key]: value });
  return (
    <div className="source-controls">
      <Choice
        label="Waveform"
        value={source.waveform}
        options={[
          { value: 'sine', label: 'Sine' },
          { value: 'square', label: 'Square' },
          { value: 'triangle', label: 'Triangle' },
        ]}
        onChange={(v) => set('waveform', v)}
      />
      <Field
        label={`${label} amplitude`}
        value={source.amplitude}
        min={0}
        max={10}
        step={0.05}
        unit="V peak"
        onChange={(v) => set('amplitude', v)}
      />
      <Field
        label={`${label} frequency`}
        value={source.frequency}
        min={1}
        max={1e6}
        step={1}
        log
        unit="Hz"
        onChange={(v) => set('frequency', v)}
      />
      <Field
        label={`${label} DC offset`}
        value={source.offset}
        min={-10}
        max={10}
        step={0.1}
        unit="V"
        onChange={(v) => set('offset', v)}
      />
      <Field
        label={`${label} phase`}
        value={source.phase}
        min={-180}
        max={180}
        step={1}
        unit="°"
        onChange={(v) => set('phase', v)}
      />
    </div>
  );
}
