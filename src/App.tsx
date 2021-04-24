/* eslint-disable */
import * as d3 from 'd3'
import React from 'react'

export const App = () => {
    const fps$ = React.useRef<HTMLSpanElement>()
    const modes = ['svg', 'canvas', 'webgl'] as const
    const edges = [4, 7, 10, 15, 20]
    const gaps = [0, 0.5, 1, 2, 4]
    const [mode, nextMode] = React.useReducer(v => modes[(modes.indexOf(v) + 1) % modes.length], 'svg')
    const [width, nextWidth] = React.useReducer(v => (v + 300) % 800, 550)
    const [height, nextHeight] = React.useReducer(v => (v + 100) % 500, 350)
    const [edge, nextEdge] = React.useReducer(v => edges[(edges.indexOf(v) + 1) % edges.length], 10)
    const [gap, nextGap] = React.useReducer(v => gaps[(gaps.indexOf(v) + 1) % gaps.length], 2)
    const [fill, nextFill] = React.useReducer(v => !v, false)
    // prettier-ignore
    const [colors, nextColors] = React.useReducer(() => {
        return [...Array(2 + Math.round(Math.random() * 4))]
            .map((_, i) => [i === 0 ? 1 : Math.random(), `#${Math.random().toString(16).slice(-3)}`] as const)
            .sort((a, b) => a[0] - b[0])
    }, [[0.1, '#FFF'],[0.5, '#FEA'],[0.6, '#F75'],[1, '#902']])

    React.useEffect(() => {
        let fps = 60
        let low = 60
        let lowFrames = 0
        let previous = performance.now()
        const computeFps = () => {
            window.requestAnimationFrame(() => {
                const now = performance.now()
                const delta = now - previous
                previous = now
                fps = Math.round(1000 / delta)
                if (fps < low || lowFrames > 60) {
                    low = fps
                    lowFrames = 0
                }
                lowFrames += 1
                fps$.current!.textContent = `fps: ${fps} low: ${low}`
                computeFps()
            })
        }
        computeFps()
    }, [])

    const map = (x: number, y: number, count: { x: number; y: number }) => {
        const ratio = (x * count.y + y) / (count.x * count.y)
        return colors.find(([v]) => v > ratio)?.[1] ?? ''
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <button onClick={nextMode}>{`mode ${mode}`}</button>
            <button onClick={nextWidth}>{`width ${width}`}</button>
            <button onClick={nextHeight}>{`height ${height}`}</button>
            <button onClick={nextEdge}>{`edge ${edge}`}</button>
            <button onClick={nextGap}>{`gap ${gap}`}</button>
            <button onClick={nextFill}>{`fill ${fill}`}</button>
            <button onClick={nextColors}>{`change colors`}</button>
            <span ref={fps$ as any} style={{ fontFamily: 'monospace' }} />
            <div style={{ width, height, transition: 'all 0.3s', background: 'darkblue', padding: 20 }}>
                <Heatmap mode={mode} gap={gap} edge={edge} fill={fill} map={map} />
            </div>
        </div>
    )
}

/**
 * Heatmap component.
 * @param props.mode rendering mode, it can be `'svg'`, `'canvas' or `'webgl``
 * @param props.edge edge size of a heatmap tile
 * @param props.gap space between tiles
 * @param props.fill if `true`, scale tiles to fill remaining space
 * @param props.map function that takes tile position and count and returns a color
 */
const Heatmap = (props: {
    mode: 'svg' | 'canvas' | 'webgl'
    edge: number
    gap: number
    fill: boolean
    map: (x: number, y: number, count: { x: number; y: number }) => string
}) => {
    const root$ = React.useRef<HTMLOrSVGElement>()

    React.useLayoutEffect(() => {
        const container$ = root$.current
        if (!container$) return
        const render = props.mode === 'svg' ? renderSvg : props.mode === 'canvas' ? renderCanvas : renderWebgl
        render(container$, props.edge, props.gap, props.fill, props.map)
        let size = { x: container$.clientWidth ?? 0, y: container$.clientHeight ?? 0 }
        const interval = setInterval(() => {
            if (container$.clientWidth === size.x && container$.clientHeight === size.y) return
            size = { x: root$.current.clientWidth, y: root$.current.clientHeight }
            render(container$, props.edge, props.gap, props.fill, props.map)
        }, 500)
        return () => clearInterval(interval)
    }, [root$.current, props.mode, props.edge, props.gap, props.fill, props.map])

    const renderSvg = (svg$: SVGSVGElement, edge: number, gap: number, fill: number, map: any) => {
        const size = { x: svg$.clientWidth, y: svg$.clientHeight }
        const fit = { x: size.x / (edge + gap), y: size.y / (edge + gap) }
        const count = { x: Math.floor(fit.x), y: Math.floor(fit.y) }
        d3.select(svg$)
            .attr('viewBox', `0 0 ${size.x} ${size.y}`)
            .attr('preserveAspectRatio', 'none')
            .selectAll('g')
            .data([undefined])
            .join('g')
            .attr('transform', !fill ? '' : `scale(${fit.x / count.x}, ${fit.y / count.y})`)
            .selectAll('rect')
            .data(Array(count.x * count.y))
            .join('rect')
            .attr('width', edge)
            .attr('height', edge)
            .attr('x', (_, i) => (i % count.x) * (edge + gap))
            .attr('y', (_, i) => Math.floor(i / count.x) * (edge + gap))
            .attr('fill', (_, i) => map(i % count.x, Math.floor(i / count.x), count))
            .style('transition', 'fill 1s')
    }

    const renderCanvas = (canvas$: HTMLCanvasElement, edge: number, gap: number, fill: number, map: any) => {
        const context = canvas$.getContext('2d', { desynchronized: true })
        if (!context) return
        const size = { x: canvas$.clientWidth, y: canvas$.clientHeight }
        const fit = { x: size.x / (edge + gap), y: size.y / (edge + gap) }
        const count = { x: Math.floor(fit.x), y: Math.floor(fit.y) }
        canvas$.width = size.x * (!fill ? 1 : 1 / (fit.x / count.x))
        canvas$.height = size.y * (!fill ? 1 : 1 / (fit.y / count.y))
        context.clearRect(0, 0, canvas$.width, canvas$.height)
        ;[...Array(count.x * count.y)].forEach((_, i) => {
            const x = (i % count.x) * (edge + gap)
            const y = Math.floor(i / count.x) * (edge + gap)
            context.fillStyle = props.map(i % count.x, Math.floor(i / count.x), count)
            context.fillRect(x, y, edge, edge)
        })
    }

    const renderWebgl = (canvas$: HTMLCanvasElement, edge: number, gap: number, fill: number, map: any) => {
        const gl = canvas$.getContext('webgl', { desynchronized: true })
        if (!gl) return
        const size = { x: canvas$.clientWidth, y: canvas$.clientHeight }
        const fit = { x: size.x / (edge + gap), y: size.y / (edge + gap) }
        const count = { x: Math.floor(fit.x), y: Math.floor(fit.y) }
        gl.clearColor(0.0, 0.0, 0.0, 0.0)
        gl.clear(gl.COLOR_BUFFER_BIT)
    }

    const Element = props.mode === 'svg' ? 'svg' : 'canvas'

    return (
        <Element
            key={props.mode}
            ref={root$ as any}
            style={{ width: '100%', height: '100%', outline: '1px solid green' }}
        />
    )
}
