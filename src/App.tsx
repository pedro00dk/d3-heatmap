import './styles.css'
import * as d3 from 'd3'
import React from 'react'

export const App = () => {
    const edges = [4, 7, 10, 15, 20]
    const gaps = [0, 0.5, 1, 2, 4]
    const [width, nextWidth] = React.useReducer((v) => (v + 300) % 800, 550)
    const [height, nextHeight] = React.useReducer((v) => (v + 100) % 500, 350)
    const [edge, nextEdge] = React.useReducer((v) => edges[(edges.indexOf(v) + 1) % edges.length], 10)
    const [gap, nextGap] = React.useReducer((v) => gaps[(gaps.indexOf(v) + 1) % gaps.length], 2)
    const [fill, nextFill] = React.useReducer((v) => !v, false)
    // prettier-ignore
    const [colors, nextColors] = React.useReducer(() => {
        return [...Array(2 + Math.round(Math.random() * 4))]
            .map((_, i) => [i === 0 ? 1 : Math.random(), `#${Math.random().toString(16).substr(-6)}`] as const)
            .sort((a, b) => a[0] - b[0])
    }, [[0.1, '#FFF'],[0.5, '#FEA'],[0.6, '#F75'],[1, '#902']])

    const map = (x: number, y: number, count: { x: number; y: number }) => {
        const ratio = (x * count.y + y) / (count.x * count.y)
        return colors.find(([v]) => v > ratio)?.[1] ?? ''
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <button onClick={nextWidth}>{`change width ${width}`}</button>
            <button onClick={nextHeight}>{`change height ${height}`}</button>
            <button onClick={nextEdge}>{`change edge ${edge}`}</button>
            <button onClick={nextGap}>{`change gap ${gap}`}</button>
            <button onClick={nextFill}>{`change fill ${fill}`}</button>
            <button onClick={nextColors}>{`change colors`}</button>
            <div
                style={{ display: 'flex', width, height, transition: 'all 0.3s', background: 'darkblue', padding: 20 }}>
                <Heatmap gap={gap} edge={edge} fill={fill} map={map} />
            </div>
        </div>
    )
}

/**
 * Heatmap component.
 * This component renders a simple heatmap using svg.
 * The component is responsive, but it requires to be inside a flex parent (which may have other children).
 *
 * @param props.edge edge size of a heatmap tile
 * @param props.gap space between tiles
 * @param props.fill if `true`, scale tiles to fill remaining space
 * @param props.map function that takes tile position and count and returns a color
 */
const Heatmap = (props: {
    edge: number
    gap: number
    fill: boolean
    map: (x: number, y: number, count: { x: number; y: number }) => string
}) => {
    const svg$ = React.useRef<SVGSVGElement>()
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
            .attr('x', (_, i) => (i % count.x) * (props.edge + props.gap))
            .attr('y', (_, i) => Math.floor(i / count.x) * (props.edge + props.gap))
            .attr('fill', (_, i) => props.map(i % count.x, Math.floor(i / count.x), count))
            .style('transition', 'fill 1s')
    }

    return <svg ref={svg$ as any} style={{ flex: 1, outline: '1px solid green' }} />
}
