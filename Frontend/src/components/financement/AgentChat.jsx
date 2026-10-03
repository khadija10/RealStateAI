import { useEffect, useRef, useState } from 'react'
import { resetFinancingAgent, sendFinancingAgentMessage } from '../../api/client'
import { cx } from '../../lib/cx'
import { Button, Card, IconArrowRight, Spinner } from '../ui'

const nouvelleSession = () => `sess-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`

const SUGGESTIONS = [
  'Puis-je emprunter sur 20 ans avec mon profil ?',
  'Combien d’apport me faut-il ?',
  'Quels sont les frais de notaire ?',
]

/** Libellé lisible d'un outil appelé par l'agent (« calculer_capacite » → « calculer capacite »). */
const outil = (o) => String(o).replace(/_/g, ' ')

/**
 * Agent conversationnel du backend (POST /api/financing/agent/message) :
 * chaque réponse s'appuie sur les calculs du moteur, affichés sous la bulle.
 */
export default function AgentChat() {
  const [session, setSession] = useState(nouvelleSession)
  const [fil, setFil] = useState([])
  const [message, setMessage] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const filRef = useRef(null)
  const sessionRef = useRef(session)

  useEffect(() => { sessionRef.current = session }, [session])
  useEffect(() => () => { resetFinancingAgent(sessionRef.current).catch(() => {}) }, [])
  useEffect(() => {
    filRef.current?.scrollTo({ top: filRef.current.scrollHeight, behavior: 'smooth' })
  }, [fil, envoi])

  async function envoyer(texte) {
    const m = texte.trim()
    if (!m || envoi) return
    setFil((f) => [...f, { role: 'moi', texte: m }])
    setMessage('')
    setEnvoi(true)
    try {
      const d = await sendFinancingAgentMessage(session, m)
      setFil((f) => [...f, { role: 'agent', texte: d?.reply || 'Réponse vide.', outils: d?.outils_appeles ?? [] }])
    } catch (e) {
      setFil((f) => [...f, { role: 'erreur', texte: e.message || 'L’agent est momentanément indisponible.' }])
    } finally {
      setEnvoi(false)
    }
  }

  function recommencer() {
    resetFinancingAgent(session).catch(() => {})
    setSession(nouvelleSession())
    setFil([])
  }

  return (
    <Card padding="lg" className="flex h-full flex-col rounded-[22px]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="ds-h3">Posez <em>vos questions</em></h3>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">L’agent appelle le même moteur de calcul : il n’invente aucun chiffre.</p>
        </div>
        {fil.length > 0 && <Button variant="ghost" size="sm" onClick={recommencer}>Nouvelle conversation</Button>}
      </div>

      <div ref={filRef} className="flex min-h-[180px] flex-1 flex-col gap-2.5 overflow-y-auto rounded-[16px] bg-surface-2 p-3 ring-1 ring-inset ring-line lg:max-h-[300px]" aria-live="polite">
        {fil.length === 0 && (
          <div className="m-auto flex max-w-sm flex-col items-center gap-2.5 py-4 text-center">
            <p className="text-[13px] text-ink-muted">Durée, apport, éligibilité, frais… Essayez :</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => envoyer(s)} className="rounded-full bg-surface px-3 py-1.5 text-[12px] text-ink-soft ring-1 ring-inset ring-line hover:ring-line-strong">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {fil.map((b, i) => (
          <div key={i} className={cx('flex flex-col gap-1', b.role === 'moi' ? 'items-end' : 'items-start')}>
            <p
              className={cx(
                'max-w-[85%] whitespace-pre-line rounded-[16px] px-3.5 py-2 text-[13px] leading-relaxed',
                b.role === 'moi' && 'rounded-br-[5px] bg-brand text-on-brand',
                b.role === 'agent' && 'rounded-bl-[5px] bg-surface text-ink ring-1 ring-inset ring-line',
                b.role === 'erreur' && 'rounded-bl-[5px] bg-danger-soft text-ink ring-1 ring-inset ring-danger/25',
              )}
            >
              {b.texte}
            </p>
            {b.outils?.length > 0 && (
              <p className="max-w-[85%] text-[11px] text-ink-muted">Calculs utilisés : {b.outils.map(outil).join(' · ')}</p>
            )}
          </div>
        ))}
        {envoi && (
          <p className="flex items-center gap-2 text-[12.5px] text-ink-muted" role="status"><Spinner size={13} /> L’agent calcule…</p>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); envoyer(message) }} className="mt-3 flex gap-2">
        <label htmlFor="fin-agent" className="sr-only">Votre question</label>
        <input
          id="fin-agent"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4000}
          placeholder="Ex. puis-je emprunter sur 20 ans avec mon profil ?"
          className="h-11 min-w-0 flex-1 rounded-full bg-surface px-4 text-[13.5px] text-ink outline-none ring-1 ring-inset ring-line-strong placeholder:text-ink-muted/80 focus:ring-2 focus:ring-ink-muted"
        />
        <Button type="submit" className="h-11 rounded-full px-5" disabled={!message.trim() || envoi} iconRight={<IconArrowRight size={16} />}>
          Envoyer
        </Button>
      </form>
    </Card>
  )
}
