import { useEffect, useRef, useState } from 'react'
import contract from '../../docs/scene.contract.yaml?raw'
import { mountScene } from './engine/svg.ts'
import { compileYaml } from './engine/yaml.ts'

type Player = ReturnType<typeof mountScene>

function App() {
  const [source, setSource] = useState(contract)
  const [scene, setScene] = useState(() => compileYaml(contract))
  const [error, setError] = useState<string>()
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const preview = useRef<HTMLDivElement>(null)
  const player = useRef<Player>(null)
  const frame = useRef(0)
  const currentTime = useRef(0)
  const playStarted = useRef(0)
  const playOffset = useRef(0)

  const pause = () => {
    player.current?.pause()
    cancelAnimationFrame(frame.current)
    setPlaying(false)
  }

  const seek = (nextTime: number) => {
    const bounded = Math.min(nextTime, scene.maxTime)
    player.current?.time(bounded)
    currentTime.current = bounded
    setTime(bounded)
  }

  const tick = (now: number) => {
    const nextTime = Math.min(
      playOffset.current + (now - playStarted.current) / 1000 * scene.precision,
      scene.maxTime,
    )
    seek(nextTime)
    if (nextTime === scene.maxTime) pause()
    else frame.current = requestAnimationFrame(tick)
  }

  const togglePlayback = () => {
    if (playing) return pause()
    if (time === scene.maxTime) seek(0)
    playOffset.current = time === scene.maxTime ? 0 : time
    playStarted.current = performance.now()
    setPlaying(true)
    frame.current = requestAnimationFrame(tick)
  }

  const edit = (nextSource: string) => {
    pause()
    setSource(nextSource)
    try {
      const nextScene = compileYaml(nextSource)
      setScene(nextScene)
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  useEffect(() => {
    player.current = mountScene(preview.current!, scene)
    player.current.time(currentTime.current)
    return () => player.current?.destroy()
  }, [scene])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="wordmark">ANIMPURE <span>/ STUDIO</span></div>
        <div className="scene-name">{scene.name}</div>
        <div className={`status ${error ? 'status-error' : ''}`}>
          <span />{error ? 'INVALID CONTRACT' : 'LIVE'}
        </div>
      </header>

      <div className="workspace">
        <section className="editor-pane" aria-label="YAML editor">
          <div className="pane-header">
            <span>scene.contract.yaml</span>
            <span>YAML</span>
          </div>
          <textarea
            aria-label="Scene YAML"
            value={source}
            onChange={(event) => edit(event.target.value)}
            spellCheck={false}
          />
          <div className={`diagnostic ${error ? 'diagnostic-error' : ''}`} role="status">
            {error ?? `${scene.objects.length} OBJECTS · ${scene.timelines.length} TIMELINE`}
          </div>
        </section>

        <section className="preview-pane" aria-label="SVG preview">
          <div className="pane-header">
            <span>Preview</span>
            <span>{scene.size.x} × {scene.size.y} {scene.unit}</span>
          </div>
          <div className="stage-wrap">
            <div
              className="stage"
              ref={preview}
              style={{ aspectRatio: `${scene.size.x} / ${scene.size.y}` }}
            />
          </div>
        </section>
      </div>

      <footer className="transport">
        <button type="button" onClick={togglePlayback} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? 'Ⅱ' : '▶'}
        </button>
        <button type="button" onClick={() => { pause(); seek(0) }} aria-label="Reset">
          ↺
        </button>
        <span className="timecode">{time.toFixed(2)}s</span>
        <input
          aria-label="Timeline"
          type="range"
          min="0"
          max={scene.maxTime}
          step="0.01"
          value={time}
          onChange={(event) => { pause(); seek(Number(event.target.value)) }}
        />
        <span className="duration">{scene.maxTime.toFixed(2)}s</span>
        <span className="rate">×{scene.precision}</span>
      </footer>
    </main>
  )
}

export default App
