function getDivPositionAndSize(elem) {
    const rect = elem.getBoundingClientRect();
    const obj = {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        w: rect.width,
        h: rect.height
    };
    return obj;
}

function findChildNodesByClass(parentId, className) {
    const parent = document.getElementById(parentId);
    if (parent) {
        const children = parent.querySelectorAll(`.${className}`);
        return Array.from(children);
    } else {
        return [];
    }
}

function createDiv(divId = null, classes = null, content = null) {
    const newDiv = document.createElement('div');
    if (divId != null) { newDiv.id = divId; }
    if (classes != null) { newDiv.classList.add(...classes); }
    if (content != null) { newDiv.textContent = content; }
    newDiv.style.position = 'absolute'; // Ensure absolute positioning
    return newDiv;
}

function getUniqueNodes(connections) {
    let nodes = new Set();
    for (let conn of connections) {
        for (let node of conn) {
            nodes.add(node);
        }
    }
    let result = Array.from(nodes);
    result.sort();
    return result;
}

const _connections = [
    ["apple", "fruit"],
    ["apple", "sweet"],
    ["lemon", "fruit"],
    ["lemon", "sour"],
    ["banana", "fruit"],
    ["banana", "sweet"],
    ["sugar", "sweet"],

    // Some more examples to try
    
    // ["mango", "fruit"],
    // ["mango", "sweet"],
    // ["orange", "fruit"],
    // ["orange", "sour"],
    // ["grape", "fruit"],
    // ["grape", "savory"],
    // ["watermelon", "savory"],
    // ["watermelon", "fruit"],
    
    
    
];

const K = 0.1; // Spring constant
const C = 100; // Coulomb constant
const damping = 0.85; // Damping factor
const iterations = 1000; // Number of iterations
const minDist = 120; // Minimum distance between nodes to prevent overlap

// Node class to store position and velocity
class Node {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
    }
}

// Create nodes and initialize positions in a circular arrangement
function createNodes(nodeNames) {
    const nodes = {};
    const center = 300;
    const radius = 200;
    const numNodes = nodeNames.length;
    const phase = 2 * Math.PI / numNodes;

    nodeNames.forEach((name, idx) => {
        const x = center + radius * Math.cos(idx * phase);
        const y = center + radius * Math.sin(idx * phase);
        nodes[name] = new Node(name, x, y);
    });

    return nodes;
}

// Check for overlaps and adjust positions
function preventOverlap(nodes) {
    for (let key1 in nodes) {
        for (let key2 in nodes) {
            if (key1 !== key2) {
                let dx = nodes[key1].x - nodes[key2].x;
                let dy = nodes[key1].y - nodes[key2].y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist) {
                    let angle = Math.atan2(dy, dx);
                    let moveDist = (minDist - dist) / 2;
                    nodes[key1].x += moveDist * Math.cos(angle);
                    nodes[key1].y += moveDist * Math.sin(angle);
                    nodes[key2].x -= moveDist * Math.cos(angle);
                    nodes[key2].y -= moveDist * Math.sin(angle);
                }
            }
        }
    }
}

// Calculate forces and update positions
function updatePositions(nodes, connections) {
    for (let i = 0; i < iterations; i++) {
        // Reset forces
        let forces = {};
        for (let key in nodes) {
            forces[key] = { fx: 0, fy: 0 };
        }

        // Calculate repulsive forces
        for (let key1 in nodes) {
            for (let key2 in nodes) {
                if (key1 !== key2) {
                    let dx = nodes[key1].x - nodes[key2].x;
                    let dy = nodes[key1].y - nodes[key2].y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist === 0) dist = 0.1; // Prevent division by zero
                    let force = (C / (dist * dist));
                    forces[key1].fx += force * dx / dist;
                    forces[key1].fy += force * dy / dist;
                }
            }
        }

        // Calculate spring forces
        connections.forEach(conn => {
            let [key1, key2] = conn;
            let dx = nodes[key1].x - nodes[key2].x;
            let dy = nodes[key1].y - nodes[key2].y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            let force = -K * (dist - 150); // Adjust desired distance
            forces[key1].fx += force * dx / dist;
            forces[key1].fy += force * dy / dist;
            forces[key2].fx -= force * dx / dist;
            forces[key2].fy -= force * dy / dist;
        });

        // Update velocities and positions
        for (let key in nodes) {
            nodes[key].vx = (nodes[key].vx + forces[key].fx) * damping;
            nodes[key].vy = (nodes[key].vy + forces[key].fy) * damping;
            nodes[key].x += nodes[key].vx;
            nodes[key].y += nodes[key].vy;
        }

        // Prevent overlaps
        preventOverlap(nodes);
    }
}

function getCenterPoint(elemId) {
    let elem = document.getElementById(elemId);
    let rect = elem.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
}

function createLine(id1, id2) {
    let svg = document.getElementById("main_bg_svg");
    let rect = svg.getBoundingClientRect();
    let p1 = getCenterPoint(id1);
    let p2 = getCenterPoint(id2);
    let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", p1.x - rect.left);
    line.setAttribute("y1", p1.y - rect.top);
    line.setAttribute("x2", p2.x - rect.left);
    line.setAttribute("y2", p2.y - rect.top);
    line.setAttribute("stroke", "black");
    svg.appendChild(line);
}

function drawConnections(connections) {
    for (let conn of connections) {
        createLine(conn[0], conn[1]);
    }
}

function drawGraph(nodes) {
    let canvas = document.getElementById("main_canvas");
    for (let key in nodes) {
        let node = nodes[key];
        let nodeDiv = createDiv(node.id, ["node"], node.id);
        canvas.appendChild(nodeDiv);
        nodeDiv.style.left = `${node.x}px`;
        nodeDiv.style.top = `${node.y}px`;
    }
}

// Main function to draw the graph
function main() {
    let nodeNames = getUniqueNodes(_connections);
    let nodes = createNodes(nodeNames);
    updatePositions(nodes, _connections);
    drawGraph(nodes);
    drawConnections(_connections);
}

window.onload = main;
