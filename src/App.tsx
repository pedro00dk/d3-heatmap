import './styles.css'
import * as d3 from 'd3'
import React from 'react'

export const App = () => {
    const edges = [4, 7, 10, 15, 20]
    const gaps = [0, 0.5, 1, 2, 4]
    const [size, nextSize] = React.useReducer((v) => (v + 300) % 800, 550)
    const [edge, nextEdge] = React.useReducer((v) => edges[(edges.indexOf(v) + 1) % edges.length], 10)
    const [gap, nextGap] = React.useReducer((v) => gaps[(gaps.indexOf(v) + 1) % gaps.length], 2)
    const [fill, nextFill] = React.useReducer((v) => !v, false)
    const [colors, nextColors] = React.useReducer(
        () =>
            [...Array(1 + Math.round(Math.random() * 6))].map((_, i) => [
                i === 0 ? 1 : Math.random(),
                `#${Math.random().toString(16).substr(-6)}`,
            ]),
        [
            [0.1, '#FFF'],
            [0.5, '#FEA'],
            [0.6, '#F75'],
            [1, '#902'],
        ],
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{ width: size, height: 350, transition: 'width 0.3s', background: 'darkblue', padding: 20 }}>
                <Heatmap gap={gap} edge={edge} fill={fill} colors={colors as any} />
            </div>
            <button onClick={nextSize}>{`change size ${size}`}</button>
            <button onClick={nextEdge}>{`change edge ${edge}`}</button>
            <button onClick={nextGap}>{`change gap ${gap}`}</button>
            <button onClick={nextFill}>{`change fill ${fill}`}</button>
            <button onClick={nextColors}>{`change colors`}</button>
        </div>
    )
}

const Heatmap = (props: { edge: number; gap: number; fill: boolean; colors: [number, string][] }) => {
    const svg$ = React.useRef<SVGSVGElement>()
    console.log(props.gap)
    React.useLayoutEffect(() => {
        render()
        let size = { x: svg$.current?.clientWidth ?? 0, y: svg$.current?.clientHeight ?? 0 }
        const interval = setInterval(() => {
            if (!svg$.current || (svg$.current.clientWidth === size.x && svg$.current.clientHeight === size.y)) return
            size = { x: svg$.current.clientWidth, y: svg$.current.clientHeight }
            render()
        }, 500)
        return () => clearInterval(interval)
    })

    const render = () => {
        if (!svg$.current) return
        const size = { x: svg$.current.clientWidth, y: svg$.current.clientHeight }
        const fit = { x: size.x / (props.edge + props.gap), y: size.y / (props.edge + props.gap) }
        const count = { x: Math.floor(fit.x), y: Math.floor(fit.y) }
        console.log(size, fit, count)
        props.colors.sort((a, b) => a[0] - b[0])
        d3.select(svg$.current)
            .attr('viewBox', `0 0 ${size.x} ${size.y}`)
            .attr('preserveAspectRatio', 'none')
            .selectAll('g')
            .data([0])
            .join('g')
            .attr('transform', props.fill ? `scale(${fit.x / count.x}, ${fit.y / count.y})` : '')
            .selectAll('rect')
            .data([...Array(count.x * count.y)])
            .join('rect')
            .attr('width', props.edge)
            .attr('height', props.edge)
            .attr('x', (_, i) => Math.floor(i / count.y) * (props.edge + props.gap))
            .attr('y', (_, i) => (i % count.y) * (props.edge + props.gap))
            .attr('fill', (_, i) => props.colors.find(([v]) => v > i / (count.x * count.y))?.[1] ?? '')
    }

    return <svg ref={svg$ as any} style={{ width: '100%', height: '100%', outline: '1px solid green' }} />
}
