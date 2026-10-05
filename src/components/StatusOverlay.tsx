import './StatusOverlay.css'

export function StatusOverlay({ text }: { text: string }) {
  return <div className="status-overlay">{text}</div>
}
