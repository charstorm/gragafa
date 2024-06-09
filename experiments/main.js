
function getDivPositionAndSize(elem) {
    const rect = elem.getBoundingClientRect()
    const obj = {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        w: rect.width,
        h: rect.height
    }
    return obj
}


function findChildNodesByClass(parentId, className) {
    const parent = document.getElementById(parentId);
    if (parent) {
        const children = parent.querySelectorAll(`.${className}`)
        return Array.from(children)
    } else {
        return []
    }
}


function createDiv(divId=null, classes=null, content=null) {
    const newDiv = document.createElement('div')
    if (divId != null) { newDiv.id = divId }
    if (classes != null) { newDiv.classList.add(...classes) }
    if (content != null) { newDiv.textContent = content }
    return newDiv
}


function getUniqueNodes(connections) {
    let nodes = new Set()
    for (let conn of connections) {
        for (let node of conn) {
            nodes.add(node)
        }
    }
    let result = Array.from(nodes)
    result.sort()
    return result
}


const _connections = [
    ["apple", "fruit"],
    ["apple", "sweet"],
    ["lemon", "fruit"],
    ["lemon", "sour"],
    ["banana", "fruit"],
    ["banana", "sweet"],
    ["sugar", "sweet"],
]


function circularArrangement(nodeNames) {
    let canvas = document.getElementById("main_canvas")
    let center = 300
    let radius = 200
    let numNodes = nodeNames.length
    let phase = 2 * Math.PI / numNodes
    let nodeElements = []
    for (let idx = 0; idx < nodeNames.length; idx++) {
        let name = nodeNames[idx]
        let x = center + radius * Math.cos(idx * phase + 2)
        let y = center - radius * Math.sin(idx * phase + 2)
        let nodeDiv = createDiv(name, ["node"], name)
        canvas.appendChild(nodeDiv)
        let rect = nodeDiv.getBoundingClientRect()
        x -= rect.width
        y -= rect.height
        nodeDiv.style.left = `${x}px`
        nodeDiv.style.top = `${y}px`
        nodeElements.push(nodeDiv)
    }
    return nodeElements
}


function getCenterPoint(elemId) {
    let elem = document.getElementById(elemId)
    let rect = elem.getBoundingClientRect()
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    }
}


function createLine(id1, id2) {
    let svg = document.getElementById("main_bg_svg")
    let rect = svg.getBoundingClientRect()
    let p1 = getCenterPoint(id1)
    let p2 = getCenterPoint(id2)
    let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", p1.x-rect.left)
    line.setAttribute("y1", p1.y-rect.top)
    line.setAttribute("x2", p2.x-rect.left)
    line.setAttribute("y2", p2.y-rect.top)
    line.setAttribute("stroke", "black")
    svg.appendChild(line)
}


function drawConnections(connections) {
    for (let conn of connections) {
        createLine(conn[0], conn[1])
    }
}


function drawgraph() {
    let nodeNames = getUniqueNodes(_connections)
    let nodes = circularArrangement(nodeNames)
    drawConnections(_connections, nodes)
}


function main() {
    drawgraph()
}


window.onload = main

