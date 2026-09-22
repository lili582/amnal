import { strings } from '../strings.he'
import type { Settings } from '../lib/storage'
import { Modal } from './Modal'

interface SettingsModalProps {
  settings: Settings
  onChange: (next: Settings) => void
  onClose: () => void
}

export function SettingsModal({ settings, onChange, onClose }: SettingsModalProps) {
  return (
    <Modal title={strings.settingsTitle} onClose={onClose}>
      <label className="setting-row">
        <span>{strings.colorblind}</span>
        <input
          type="checkbox"
          checked={settings.colorblind}
          onChange={(e) => onChange({ ...settings, colorblind: e.target.checked })}
        />
      </label>
      <fieldset className="theme-picker" aria-label={strings.settingsTitle}>
        <button
          type="button"
          className={`theme-option${settings.theme === 'dark' ? ' active' : ''}`}
          onClick={() => onChange({ ...settings, theme: 'dark' })}
        >
          {strings.themeDark}
        </button>
        <button
          type="button"
          className={`theme-option${settings.theme === 'light' ? ' active' : ''}`}
          onClick={() => onChange({ ...settings, theme: 'light' })}
        >
          {strings.themeLight}
        </button>
      </fieldset>
    </Modal>
  )
}