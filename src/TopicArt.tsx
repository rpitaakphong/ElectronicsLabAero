export function TopicArt({ divider }: { divider: boolean }) {
  return (
    <svg viewBox="0 0 420 180" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        {divider ? (
          <>
            <path d="M85 35H190V55M190 90V110H325M190 110V125M190 155V168M176 168H204" />
            <rect x="180" y="55" width="20" height="35" />
            <rect x="180" y="125" width="20" height="30" />
            <circle cx="190" cy="110" r="4" fill="currentColor" />
            <text x="70" y="25">
              Vin
            </text>
            <text x="335" y="115">
              Vout
            </text>
            <text x="215" y="80">
              R1
            </text>
            <text x="215" y="148">
              R2
            </text>
          </>
        ) : (
          <>
            <path d="M160 40V145L260 93ZM75 68H160M75 118H160M260 93H335M285 93V25H115V68" />
            <text x="172" y="75">
              −
            </text>
            <text x="172" y="126">
              +
            </text>
            <text x="300" y="118">
              Vout
            </text>
          </>
        )}
      </g>
    </svg>
  );
}
