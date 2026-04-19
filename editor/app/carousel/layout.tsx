export default function CarouselLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      {children}
    </div>
  )
}
