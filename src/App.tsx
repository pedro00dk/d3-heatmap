import * as d3 from 'd3'
import { mat4 } from 'gl-matrix'
import React from 'react'

export const App = () => {
    const fps$ = React.useRef<HTMLSpanElement>()
    const modes = ['svg', 'canvas', 'webgl'] as const
    const edges = [4, 7, 10, 15, 20]
    const gaps = [0, 0.5, 1, 2, 4]
    const [mode, nextMode] = React.useReducer(v => modes[(modes.indexOf(v) + 1) % modes.length], 'webgl')
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

    const map = (i: number, j: number, count: { x: number; y: number }) => {
        const ratio = (i * count.y + j) / (count.x * count.y)
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
 * The component supports three rendering modes.
 * - `'svg'`: render in a svg, supports color transitions, slow when tiles are small
 * - `'canvas'`: render in a 2D canvas, no color transitions, faster than `'svg'`
 * - `'webgl'`: render in a WebGL canvas, no color transitions, re-render every frame, but high performance
 *
 *
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
    map: (i: number, j: number, count: { x: number; y: number }) => string
}) => {
    const root$ = React.useRef<HTMLCanvasElement | SVGSVGElement>()

    React.useLayoutEffect(() => {
        const container$ = root$.current
        if (!container$) return
        const render = props.mode === 'svg' ? renderSvg : props.mode === 'canvas' ? renderCanvas : renderWebgl
        render(container$ as any, props.edge, props.gap, props.fill, props.map)
        if (props.mode === 'webgl') return
        let size = { x: container$.clientWidth ?? 0, y: container$.clientHeight ?? 0 }
        const interval = setInterval(() => {
            if (container$.clientWidth === size.x && container$.clientHeight === size.y) return
            size = { x: container$.clientWidth, y: container$.clientHeight }
            render(container$ as any, props.edge, props.gap, props.fill, props.map)
        }, 500)
        return () => clearInterval(interval)
    }, [root$.current, props.mode, props.edge, props.gap, props.fill, props.map])

    const renderSvg = (svg$: SVGSVGElement, edge: number, gap: number, fill: boolean, map: any) => {
        const size = { x: svg$.clientWidth, y: svg$.clientHeight }
        const fit = { x: size.x / (edge + gap), y: size.y / (edge + gap) }
        const count = { x: Math.floor(fit.x), y: Math.floor(fit.y) }
        const tiles = count.x * count.y
        d3.select(svg$)
            .attr('viewBox', `0 0 ${size.x} ${size.y}`)
            .attr('preserveAspectRatio', 'none')
            .selectAll('g')
            .data([undefined])
            .join('g')
            .attr('transform', !fill ? '' : `scale(${fit.x / count.x}, ${fit.y / count.y})`)
            .selectAll('rect')
            .data(Array(tiles))
            .join('rect')
            .attr('width', edge)
            .attr('height', edge)
            .attr('x', (_, i) => (i % count.x) * (edge + gap))
            .attr('y', (_, i) => Math.floor(i / count.x) * (edge + gap))
            .attr('fill', (_, i) => map(i % count.x, Math.floor(i / count.x), count))
            .style('transition', 'fill 1s')
    }

    const renderCanvas = (canvas$: HTMLCanvasElement, edge: number, gap: number, fill: boolean, map: any) => {
        const context = canvas$.getContext('2d', { desynchronized: true })
        if (!context) return
        const size = { x: canvas$.clientWidth, y: canvas$.clientHeight }
        const fit = { x: size.x / (edge + gap), y: size.y / (edge + gap) }
        const count = { x: Math.floor(fit.x), y: Math.floor(fit.y) }
        const tiles = count.x * count.y
        canvas$.width = size.x * (!fill ? 1 : 1 / (fit.x / count.x))
        canvas$.height = size.y * (!fill ? 1 : 1 / (fit.y / count.y))
        context.clearRect(0, 0, context.canvas.width, context.canvas.height)
        for (let i = 0, x = 0; i < count.x; i++, x += edge + gap)
            for (let j = 0, y = 0; j < count.y; j++, y += edge + gap) {
                context.fillStyle = props.map(i, j, count)
                context.fillRect(x, y, edge, edge)
            }
    }

    const renderWebgl = (canvas$: HTMLCanvasElement, edge: number, gap: number, fill: boolean, map: any) => {
        const gl = canvas$.getContext('webgl2', { desynchronized: true, antialias: false })
        if (!gl) return
        const program = createProgram(gl, vertexShader, fragmentShader, ['mvp'], ['position', 'color'])
        const mvp = mat4.create()
        const vertexBuffer = gl.createBuffer()
        let previousSize = { x: 0, y: 0 }
        let extraRenders = 2

        const draw = () => {
            const size = { x: canvas$.clientWidth, y: canvas$.clientHeight }
            const fit = { x: size.x / (edge + gap), y: size.y / (edge + gap) }
            const count = { x: Math.floor(fit.x), y: Math.floor(fit.y) }
            if (size.x !== previousSize.x || size.y !== previousSize.y) {
                gl.canvas.width = size.x
                gl.canvas.height = size.y
                previousSize = size
                extraRenders = 2
            }
            if (extraRenders == 0) return
            extraRenders--
            gl.clearColor(0.0, 0.0, 0.0, 0.0)
            gl.clear(gl.COLOR_BUFFER_BIT)
            gl.useProgram(program.program)
            mat4.ortho(
                mvp,
                0,
                size.x * (!fill ? 1 : 1 / (fit.x / count.x)),
                size.y * (!fill ? 1 : 1 / (fit.y / count.y)),
                0,
                -1,
                1,
            )
            gl.viewport(0, 0, canvas$.width, canvas$.height)
            gl.uniformMatrix4fv(program.uniforms['mvp'], false, mvp)
            const vertices: number[] = []
            for (let i = 0, x = 0; i < count.x; i++, x += edge + gap)
                for (let j = 0, y = 0; j < count.y; j++, y += edge + gap) {
                    const xe = x + edge
                    const ye = y + edge
                    vertices.push(x, y, xe, y, x, ye, x, ye, xe, y, xe, ye)
                }
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)
            gl.vertexAttribPointer(program.attributes['position'], 2, gl.FLOAT, false, 0, 0)
            gl.enableVertexAttribArray(program.attributes['position'])
            gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2)
        }

        const exit = () => {
            gl.deleteBuffer(vertexBuffer)
            gl.deleteProgram(program.program)
        }
        gl.isContextLost()
        const loop = () =>
            (gl.canvas as HTMLCanvasElement).parentElement ? (draw(), window.requestAnimationFrame(loop)) : exit()
        window.requestAnimationFrame(loop)
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

/**
 * Create a new program based on the received vertex and fragment shaders.
 *
 * @param gl webgl2 context
 * @param vertexSource vetex shader source code
 * @param fragmentSource fragment shader source code
 * @param uniformNames name of program uniforms
 * @param attributeNames name of program attributes (only used in vertex shaders)
 */
function createProgram(
    gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string,
    uniformNames: string[],
    attributeNames: string[],
) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program)
        gl.deleteProgram(program)
        throw Error(`failed to create program:\n${log}`)
    }
    const uniforms = uniformNames.reduce<{ [uniform: string]: WebGLUniformLocation }>(
        (acc, next) => ((acc[next] = gl.getUniformLocation(program, next)!), acc),
        {},
    )
    const attributes = attributeNames.reduce<{ [attribute: string]: number }>(
        (acc, next) => ((acc[next] = gl.getAttribLocation(program, next)!), acc),
        {},
    )
    return { program, uniforms, attributes }
}

/**
 * Create and compile a glsl shader.
 *
 * @param gl webgl2 context
 * @param type shader type `gl.VERTEX_SHADER` or `gl.FRAGMENT_SHADER`
 * @param source shader source code
 */
const compileShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader)
        gl.deleteShader(shader)
        throw Error(`failed to compile shader:\n${log}`)
    }
    return shader!
}

const vertexShader = `
uniform mat4 mvp;
attribute vec4 position;
attribute vec4 color;
varying vec4 vColor;

void main() {
    vColor = color;
    gl_Position = mvp * position;
} 
`

const fragmentShader = `
precision lowp float;

varying vec4 vColor;

void main() {
    gl_FragColor = vec4(0, 1, 0, 1);
  }
`
