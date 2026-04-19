/** Lightweight AbsoluteFill replacement for carousel preview (no Remotion dep). */
export const AbsoluteFill: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ style, ...props }) => (
  <div
    {...props}
    style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}
  />
)
