
const PALETTES = [
  ["#e9d8bd", "#d5b38d", "#8a5749", "#6f1d1b"],
  ["#d8d9ca", "#a9b7a0", "#766650", "#6f1d1b"],
  ["#ead6c7", "#c9a28e", "#99582a", "#6f1d1b"],
  ["#e1d9ce", "#aaa8a0", "#8e6657", "#6f1d1b"],
  ["#e5d6bc", "#c6b18f", "#725849", "#6f1d1b"],
];

export default function RoomIllustration({ variant = 0 }) {
  const index = variant % PALETTES.length;
  const [wall, floor, wood, burgundy] = PALETTES[index];

  return (
    <svg
      viewBox="0 0 400 240"
      className="room-illustration"
      role="img"
      aria-label="Decorative illustration of a study room"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width="400" height="240" fill={wall} />

      {/* Wall and floor */}
      <path d="M0 173 L400 173 L400 240 L0 240Z" fill={floor} />
      <path d="M0 173H400" stroke="#fff7eb" strokeWidth="4" />

      {/* Window */}
      <rect x="38" y="27" width="103" height="112" rx="3" fill="#fff8ed" />
      <rect x="46" y="35" width="87" height="96" fill="#bed1cf" />
      <path d="M89 35V131M46 83H133" stroke="#fff8ed" strokeWidth="7" />

      {/* Varying wall decor */}
      {index % 2 === 0 ? (
        <>
          <rect x="268" y="37" width="65" height="76" rx="2" fill="#fff8ed" />
          <rect x="275" y="44" width="51" height="62" fill={floor} />
          <circle cx="300" cy="66" r="15" fill={wood} opacity=".6" />
          <path d="M280 98L299 78L321 98" fill={burgundy} opacity=".65" />
        </>
      ) : (
        <>
          <path d="M269 52H344M269 57H344" stroke={wood} strokeWidth="5" />
          <rect x="279" y="22" width="13" height="30" fill={burgundy} />
          <rect x="298" y="29" width="16" height="23" fill="#f7eee1" />
          <rect x="320" y="17" width="13" height="35" fill="#a97d5b" />
        </>
      )}

      {/* Table layout */}
      {index % 3 === 0 ? (
        <>
          <path d="M105 151L240 135L307 167L170 188Z" fill={wood} />
          <path d="M170 188V209M285 170V205" stroke={burgundy} strokeWidth="8" />
          <path d="M83 165L105 154L137 168L115 181Z" fill={burgundy} />
          <path d="M83 165V204M115 181V214" stroke={burgundy} strokeWidth="8" />
          <path d="M252 189L277 178L308 193L282 207Z" fill={burgundy} />
          <path d="M282 207V231" stroke={burgundy} strokeWidth="8" />
        </>
      ) : index % 3 === 1 ? (
        <>
          <path d="M126 157L222 138L287 166L191 189Z" fill={wood} />
          <path d="M191 189V218M268 170V213" stroke={burgundy} strokeWidth="8" />
          <rect x="85" y="147" width="40" height="35" rx="9" fill={burgundy} />
          <path d="M94 182V215M115 182V215" stroke={burgundy} strokeWidth="7" />
          <rect x="274" y="176" width="42" height="33" rx="9" fill={burgundy} />
          <path d="M286 209V235M307 209V235" stroke={burgundy} strokeWidth="7" />
        </>
      ) : (
        <>
          <path d="M95 156L252 156L292 178L132 178Z" fill={wood} />
          <path d="M132 178V216M274 177V211" stroke={burgundy} strokeWidth="8" />
          <rect x="132" y="181" width="50" height="22" rx="8" fill={burgundy} />
          <path d="M144 203V227M172 203V227" stroke={burgundy} strokeWidth="7" />
          <rect x="242" y="187" width="47" height="22" rx="8" fill={burgundy} />
          <path d="M255 209V231M278 209V231" stroke={burgundy} strokeWidth="7" />
        </>
      )}

      {/* Book or laptop */}
      {index % 2 === 0 ? (
        <>
          <path d="M176 146L205 141L221 148L192 154Z" fill="#fff8ed" />
          <path d="M193 152L194 127L222 125L221 148Z" fill={burgundy} />
        </>
      ) : (
        <>
          <path d="M178 151L199 146L216 152L196 158Z" fill="#fff8ed" />
          <path d="M185 146L202 142" stroke={burgundy} strokeWidth="3" />
        </>
      )}

      {/* Plant */}
      <path d="M338 166L364 166L359 194L343 194Z" fill={wood} />
      <path
        d="M351 168V117M351 145Q322 129 328 106Q350 109 351 145M351 138Q375 116 378 99Q352 102 351 138"
        fill="#7d9871"
        stroke="#64795c"
        strokeWidth="2"
      />

      <ellipse cx="208" cy="226" rx="125" ry="7" fill={burgundy} opacity=".07" />
    </svg>
  );
}
