function joinClassNames(...values) {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(' ')
}

export function Box({ as: elementTag = 'div', className, style, children, ...rest }) {
  const Element = elementTag
  return (
    <Element className={className} style={style} {...rest}>
      {children}
    </Element>
  )
}

export function Stack({
  as = 'div',
  direction = 'column',
  gap = 12,
  align,
  justify,
  wrap = false,
  className,
  style,
  children,
  ...rest
}) {
  const nextStyle = {
    display: 'flex',
    flexDirection: direction,
    gap,
    flexWrap: wrap ? 'wrap' : 'nowrap',
    alignItems: align,
    justifyContent: justify,
    ...style,
  }
  return (
    <Box as={as} className={className} style={nextStyle} {...rest}>
      {children}
    </Box>
  )
}

export function Grid({
  as = 'div',
  columns = 2,
  gap = 12,
  className,
  style,
  children,
  ...rest
}) {
  const templateColumns =
    typeof columns === 'number' ? `repeat(${Math.max(1, columns)}, minmax(0, 1fr))` : columns
  const nextStyle = {
    display: 'grid',
    gridTemplateColumns: templateColumns,
    gap,
    ...style,
  }
  return (
    <Box as={as} className={className} style={nextStyle} {...rest}>
      {children}
    </Box>
  )
}

export function Card({ as = 'section', title, className, style, children, ...rest }) {
  return (
    <Box as={as} className={joinClassNames('card', className)} style={style} {...rest}>
      {title ? <h4 className="card-title">{title}</h4> : null}
      {children}
    </Box>
  )
}

export function Text({ as = 'p', text, className, style, children, ...rest }) {
  return (
    <Box as={as} className={className} style={style} {...rest}>
      {text ?? children}
    </Box>
  )
}

export function Heading({ level = 2, text, className, style, children, ...rest }) {
  const safeLevel = Math.min(6, Math.max(1, Number(level || 2)))
  const Tag = `h${safeLevel}`
  return (
    <Box as={Tag} className={className} style={style} {...rest}>
      {text ?? children}
    </Box>
  )
}

export function Button({ label, className, style, children, type = 'button', ...rest }) {
  return (
    <button type={type} className={className} style={style} {...rest}>
      {children ?? label}
    </button>
  )
}
