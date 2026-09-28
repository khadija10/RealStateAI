import { useState } from 'react'
import { changePassword, deleteAccount, ApiError } from '../api/client'

function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 2l12 12M6.5 6.6A2 2 0 0010.4 9.5M4.3 4.4C2.8 5.4 1.7 6.8 1 8c1.3 2.7 4 5 7 5a7.4 7.4 0 003.7-1M6.8 3.2C7.2 3.1 7.6 3 8 3c3 0 5.7 2.3 7 5-.4.8-1 1.7-1.7 2.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

function PwInput({ id, value, onChange, label, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-xs text-ink-muted mb-1" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          minLength={id === 'pw-current' ? 1 : 6}
          value={value}
          onChange={onChange}
          className="w-full border border-stone-200 rounded-lg px-3 py-2 pr-9 text-sm text-ink focus:outline-none focus:border-seine transition-colors"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
          aria-label={show ? 'Masquer' : 'Afficher'}
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  )
}

export default function ProfilePanel({ user, onLogout }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleDeleteAccount() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await deleteAccount()
      onLogout?.()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
      setDeleteConfirm(false)
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (next !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    try {
      await changePassword(current, next)
      setSuccess('Mot de passe modifié avec succès.')
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  const joinedDate = user?.created_at
    ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(user.created_at))
    : null

  return (
    <div className="max-w-md space-y-6">
      {/* Infos compte */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] p-6 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">Mon compte</p>
        <div className="flex justify-between items-baseline gap-2 py-2 border-b border-stone-100">
          <span className="text-xs text-ink-muted">Email</span>
          <span className="text-sm font-medium text-ink truncate max-w-[220px]">{user?.email}</span>
        </div>
        {joinedDate && (
          <div className="flex justify-between items-baseline gap-2 py-2">
            <span className="text-xs text-ink-muted">Membre depuis</span>
            <span className="text-xs text-ink">{joinedDate}</span>
          </div>
        )}
      </div>

      {/* Changer le mot de passe */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted mb-5">
          Changer le mot de passe
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PwInput
            id="pw-current"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            label="Mot de passe actuel"
            placeholder="••••••••"
          />
          <PwInput
            id="pw-next"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            label={<>Nouveau mot de passe <span className="text-ink-muted">(min. 6 caractères)</span></>}
            placeholder="••••••••"
          />
          <PwInput
            id="pw-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            label="Confirmer le nouveau mot de passe"
            placeholder="••••••••"
          />

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-seine text-white rounded-lg py-2.5 text-sm font-medium hover:bg-seine/90 disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Modification…
              </span>
            ) : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>

      {/* Supprimer le compte */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted mb-4">
          Zone de danger
        </p>
        <p className="text-xs text-ink-muted mb-4">
          La suppression de votre compte est définitive. Toutes vos estimations seront effacées.
        </p>
        {deleteError && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">{deleteError}</p>
        )}
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deleteLoading}
          className="w-full border border-red-300 text-red-500 hover:bg-red-50 rounded-lg py-2.5 text-sm font-medium disabled:opacity-60 transition-colors"
        >
          {deleteLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Suppression…
            </span>
          ) : deleteConfirm ? 'Confirmer la suppression' : 'Supprimer mon compte'}
        </button>
        {deleteConfirm && !deleteLoading && (
          <button
            type="button"
            onClick={() => setDeleteConfirm(false)}
            className="w-full mt-2 text-xs text-ink-muted hover:text-ink transition-colors py-1"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  )
}
