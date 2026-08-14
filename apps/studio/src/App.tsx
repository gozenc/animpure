import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Editor from '@monaco-editor/react'
import { Pause, Repeat2, SkipBack } from 'lucide-react'
import contract from '../../../.data/scene.contract.yaml?raw'
import { mountScene } from './engine/svg.ts'
import { compileYaml } from './engine/yaml.ts'
import { bindEditorShortcuts, configureYamlEditor } from './monaco.ts'

type Player = ReturnType<typeof mountScene>

function App() {
  const [source, setSource] = useState(contract)
  const [scene, setScene] = useState(() => compileYaml(contract))
  const [error, setError] = useState<string>()
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [repeating, setRepeating] = useState(false)
  const [editorRatio, setEditorRatio] = useState(0.46)
  const [resizing, setResizing] = useState(false)
  const workspace = useRef<HTMLDivElement>(null)
  const preview = useRef<HTMLDivElement>(null)
  const player = useRef<Player>(null)
  const frame = useRef(0)
  const currentTime = useRef(0)
  const playStarted = useRef(0)
  const playOffset = useRef(0)
  const repeat = useRef(false)

  const resizeEditor = (clientX: number) => {
    const bounds = workspace.current?.getBoundingClientRect()
    if (!bounds) return

    setEditorRatio(Math.min(
      Math.max((clientX - bounds.left) / bounds.width, 340 / bounds.width),
      1 - 388 / bounds.width,
    ))
  }

  const nudgeEditor = (delta: number) => {
    const bounds = workspace.current?.getBoundingClientRect()
    if (!bounds) return

    setEditorRatio(Math.min(
      Math.max(editorRatio + delta, 340 / bounds.width),
      1 - 388 / bounds.width,
    ))
  }

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
    if (nextTime === scene.maxTime && repeat.current) {
      playOffset.current = 0
      playStarted.current = now
      frame.current = requestAnimationFrame(tick)
    } else if (nextTime === scene.maxTime) pause()
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

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !document.activeElement?.closest('.monaco-editor')) {
        event.preventDefault()
        togglePlayback()
      }
      if (event.code === 'KeyS' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        void fetch('/api/scene', { method: 'PUT', body: source })
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [playing, scene.maxTime, source, time])

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="wordmark">ANIMPURE <span>/ STUDIO</span></div>
        <div className="scene-name">{scene.name}</div>
        <div className={`status ${error ? 'status-error' : ''}`}>
          <span />{error ? 'INVALID CONTRACT' : 'LIVE'}
        </div>
      </header>

      <div
        ref={workspace}
        className={`workspace ${resizing ? 'is-resizing' : ''}`}
        style={{ '--editor-width': `${editorRatio * 100}%` } as CSSProperties}
      >
        <section className="editor-pane" aria-label="YAML editor">
          <div className="pane-header">
            <span>scene.contract.yaml</span>
            <span>YAML</span>
          </div>
          <div className="editor-host">
            <Editor
              aria-label="Scene YAML"
              value={source}
              language="yaml"
              theme="animpure-yaml"
              beforeMount={configureYamlEditor}
              onMount={bindEditorShortcuts}
              onChange={(value) => edit(value ?? '')}
              options={{
                automaticLayout: true,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 14,
                lineHeight: 23,
                minimap: { enabled: false },
                padding: { top: 14, bottom: 14 },
                scrollBeyondLastLine: false,
                tabSize: 2,
                wordWrap: 'on',
              }}
            />
          </div>
          <div className={`diagnostic ${error ? 'diagnostic-error' : ''}`} role="status">
            {error ?? `${scene.objects.length} OBJECTS · ${scene.timelines.length} TIMELINE`}
          </div>
        </section>

        <div
          className="workspace-splitter"
          role="separator"
          aria-label="Resize panels"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(editorRatio * 100)}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') nudgeEditor(-0.02)
            if (event.key === 'ArrowRight') nudgeEditor(0.02)
          }}
          onMouseDown={(event) => {
            event.preventDefault()
            setResizing(true)
            resizeEditor(event.clientX)
            const move = (moveEvent: MouseEvent) => resizeEditor(moveEvent.clientX)
            const stop = () => {
              window.removeEventListener('mousemove', move)
              setResizing(false)
            }
            window.addEventListener('mousemove', move)
            window.addEventListener('mouseup', stop, { once: true })
          }}
        />

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
          {playing ? <Pause /> : '▶'}
        </button>
        <button type="button" onClick={() => { pause(); seek(0) }} aria-label="Restart">
          <SkipBack />
        </button>
        <button
          type="button"
          className={`repeat-toggle ${repeating ? 'is-active' : ''}`}
          aria-label="Repeat timeline"
          aria-pressed={repeating}
          onClick={() => {
            repeat.current = !repeat.current
            setRepeating(repeat.current)
          }}
        >
          <Repeat2 />
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
