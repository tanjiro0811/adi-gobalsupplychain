function LorryIcon({ className = '', title = 'Lorry' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={title}
      role="img"
    >
      {/* Cargo trailer body */}
      <rect
        x="1"
        y="5"
        width="13"
        height="9"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Cab */}
      <path
        d="M14 10H19.2C19.74 10 20.23 10.3 20.49 10.77L21.8 13.1C21.93 13.34 22 13.6 22 13.87V14.5H14V10Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Cab roof */}
      <path
        d="M14 10V7.5C14 6.67 14.67 6 15.5 6H18C18.55 6 19.06 6.28 19.35 6.74L20.5 8.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Ground line / chassis */}
      <line
        x1="1"
        y1="14"
        x2="22"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      {/* Rear wheel (under trailer) */}
      <circle cx="6" cy="17" r="1.8" stroke="currentColor" strokeWidth="1.7" />

      {/* Front wheel (under cab) */}
      <circle cx="18" cy="17" r="1.8" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

export default LorryIcon