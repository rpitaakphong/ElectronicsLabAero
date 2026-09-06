'use client';
import { useMemo } from 'react';
import katex from 'katex';

/** Expressions are authored in the app; only validated numeric values are interpolated. */
export function MathExpression({
  tex,
  label,
  className = '',
  inline = false,
}: {
  tex: string;
  label: string;
  className?: string;
  inline?: boolean;
}) {
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        displayMode: !inline,
        output: 'htmlAndMathml',
        throwOnError: true,
        strict: 'error',
        trust: false,
      }),
    [tex, inline],
  );
  return (
    <span
      className={`${inline ? 'math-inline' : 'math-expression'} ${className}`}
      role="math"
      aria-label={label}
      tabIndex={inline ? undefined : 0}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
