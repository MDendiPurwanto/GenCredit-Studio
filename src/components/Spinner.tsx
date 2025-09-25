export default function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="spinner"
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.floor(size / 9)) }}
    />
  )
}

