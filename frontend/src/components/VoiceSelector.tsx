interface Props {
  voices: SpeechSynthesisVoice[];
  selected: SpeechSynthesisVoice | null;
  onChange: (voice: SpeechSynthesisVoice) => void;
}

export function VoiceSelector({ voices, selected, onChange }: Props) {
  if (!voices.length) return null;

  return (
    <div className="voice-selector">
      <label className="voice-selector__label" htmlFor="voice-select">
        🔊 Voz
      </label>
      <select
        id="voice-select"
        className="voice-selector__select"
        value={selected?.name ?? ''}
        onChange={(e) => {
          const voice = voices.find((v) => v.name === e.target.value);
          if (voice) onChange(voice);
        }}
      >
        {voices.map((v) => (
          <option key={v.name} value={v.name}>
            {v.name} ({v.lang})
          </option>
        ))}
      </select>
    </div>
  );
}
