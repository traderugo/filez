const KNOB_FILL = 'bg-white' // design-exception: literal white in both themes — bg-surface would be near-black in dark, i.e. a dark knob on a dark track.

export default function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      {/* rounded-full is intended here: the square-corner rule exempts pills, and a switch
          is one. The track and knob keep their exact dimensions. */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-primary-500' : 'bg-line'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full ${KNOB_FILL} transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
      </button>
      {label && <span className="text-xs text-content-muted">{label}</span>}
    </label>
  )
}
