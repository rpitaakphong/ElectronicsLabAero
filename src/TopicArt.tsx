export function TopicArt({
  divider = false,
  rc = false,
  timer = false,
  noise = false,
}: {
  divider?: boolean;
  rc?: boolean;
  timer?: boolean;
  noise?: boolean;
}) {
  return (
    <svg viewBox="0 0 420 180" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        {noise ? (
          <>
            <path d="M38 148H385M45 25V148" opacity="0.35" />
            <path
              d="M45 112L56 98L67 118L78 89L89 106L100 83L111 99L122 72L133 87L144 57L155 77L166 54L177 80L188 62L199 95L210 78L221 109L232 91L243 120L254 105L265 126L276 109L287 130L298 107L309 122L320 96L331 112L342 84L353 99L364 74L375 86"
              opacity="0.35"
            />
            <path
              d="M45 108C90 108 111 66 155 66S211 116 265 116S330 81 375 81"
              strokeWidth="4"
            />
            <text x="220" y="40">
              Signal + noise
            </text>
          </>
        ) : timer ? (
          <>
            <rect x="140" y="40" width="100" height="95" rx="8" />
            <path d="M125 60H140M125 85H140M125 110H140M240 60H260M240 85H260M240 110H280V135H305V60H330V135H355M190 25V40M190 135V155M175 155H205" />
            <text x="158" y="93">
              555
            </text>
            <text x="290" y="35">
              OUT
            </text>
          </>
        ) : rc ? (
          <>
            <path d="M65 65H150M190 65H275V102M255 102H295M255 115H295M275 115V155M255 155H295M275 65H340" />
            <rect x="150" y="55" width="40" height="20" />
            <text x="55" y="45">
              Vin
            </text>
            <text x="330" y="45">
              Vout
            </text>
            <text x="163" y="45">
              R
            </text>
            <text x="308" y="113">
              C
            </text>
          </>
        ) : divider ? (
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
