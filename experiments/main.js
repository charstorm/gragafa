class gragafa {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = {
            K: 0.1,
            C: 1000,
            damping: 0.95,
            iterations: 300,
            minDist: 170,
            defaultNodeWidth: 100,
            defaultNodeHeight: 40,
            defaultNodeColor: '#A0CFFC',
            defaultTextColor: '#000000',
            useColoredConnections: false,
            containerWidth: 800,
            containerHeight: 600,
            containerPadding: 10,
            radialLevels: 3,
            titleFontSize: '0.9em',
            subtitleFontSize: '0.7em',
            ...options
        };
        this.nodes = {};
        this.connections = [];
        this.isPositionsCalculated = false;
        this.dialog = null;
        this.levels = [];
    }

    addNode(id, title = '', subtitle = '', link = '', color = null, width = null, height = null) {
        if (!this.nodes[id]) {
            this.nodes[id] = new Node(id, title, subtitle, link, color, width, height);
        }
    }

    addConnection(id1, id2) {
        this.addNode(id1);
        this.addNode(id2);
        if (!this.connections.some(conn => conn[0] === id1 && conn[1] === id2)) {
            this.connections.push([id1, id2]);
        }
    }

    setNodeColor(id, color) {
        if (this.nodes[id]) {
            this.nodes[id].color = color;
        } else {
            console.warn(`Node with id '${id}' does not exist.`);
        }
    }

    setNodeSize(id, width, height) {
        if (this.nodes[id]) {
            this.nodes[id].width = width;
            this.nodes[id].height = height;
            this.isPositionsCalculated = false;  // Recalculate positions when node size changes
        } else {
            console.warn(`Node with id '${id}' does not exist.`);
        }
    }

    setOption(key, value) {
        if (this.options.hasOwnProperty(key)) {
            this.options[key] = value;
            if (key === 'defaultNodeWidth' || key === 'defaultNodeHeight') {
                this.updateAllNodeSizes();
            }
        } else {
            console.warn(`Option '${key}' does not exist.`);
        }
    }

    getOption(key) {
        return this.options[key];
    }

    updateAllNodeSizes() {
        for (let key in this.nodes) {
            if (this.nodes[key].width === null) {
                this.nodes[key].width = this.options.defaultNodeWidth;
            }
            if (this.nodes[key].height === null) {
                this.nodes[key].height = this.options.defaultNodeHeight;
            }
        }
        this.isPositionsCalculated = false;
    }

    toggleColoredConnections(useColors) {
        this.options.useColoredConnections = useColors;
        this.draw();
    }

    titleFontSize(size) {
        this.options.titleFontSize = size;
        this.draw();
    }

    subtitleFontSize(size) {
        this.options.subtitleFontSize = size;
        this.draw();
    }

    nodeTextColor(id, color) {
        if (this.nodes[id]) {
            this.nodes[id].textColor = color;
            this.draw();
        } else {
            console.warn(`Node with id '${id}' does not exist.`);
        }
    }

    draw() {
        if (!this.isPositionsCalculated) {
            this._initializePositions();
            this._updatePositions();
            this.isPositionsCalculated = true;
        }
        this._drawGraph();
        this._drawConnections();
    }

    _initializePositions() {
        this._calculateLevels();
        const centerX = this.options.containerWidth / 2;
        const centerY = this.options.containerHeight / 2;
        
        this.levels.forEach((level, index) => {
            const radius = (index + 1) * (Math.min(this.options.containerWidth, this.options.containerHeight) / (2 * this.options.radialLevels));
            const angleStep = (2 * Math.PI) / level.length;
            
            level.forEach((nodeId, nodeIndex) => {
                const node = this.nodes[nodeId];
                const angle = nodeIndex * angleStep;
                node.x = centerX + radius * Math.cos(angle);
                node.y = centerY + radius * Math.sin(angle);
            });
        });
    }

    _calculateLevels() {
        this.levels = [];
        const visited = new Set();
        const queue = [Object.keys(this.nodes)[0]]; // Start with the first node
        
        while (queue.length > 0 && this.levels.length < this.options.radialLevels) {
            const levelSize = queue.length;
            const currentLevel = [];
            
            for (let i = 0; i < levelSize; i++) {
                const nodeId = queue.shift();
                if (!visited.has(nodeId)) {
                    visited.add(nodeId);
                    currentLevel.push(nodeId);
                    
                    // Add connected nodes to the queue
                    this.connections.forEach(conn => {
                        if (conn[0] === nodeId && !visited.has(conn[1])) {
                            queue.push(conn[1]);
                        }
                        if (conn[1] === nodeId && !visited.has(conn[0])) {
                            queue.push(conn[0]);
                        }
                    });
                }
            }
            
            if (currentLevel.length > 0) {
                this.levels.push(currentLevel);
            }
        }
    }

    _updatePositions() {
        for (let i = 0; i < this.options.iterations; i++) {
            let forces = this._calculateForces();
            this._applyForces(forces);
            this._preventOverlap();
        }
    }

    _calculateForces() {
        let forces = {};
        for (let key in this.nodes) {
            forces[key] = { fx: 0, fy: 0 };
        }

        // Calculate repulsive forces (Coulomb's law)
        for (let key1 in this.nodes) {
            for (let key2 in this.nodes) {
                if (key1 !== key2) {
                    let dx = this.nodes[key1].x - this.nodes[key2].x;
                    let dy = this.nodes[key1].y - this.nodes[key2].y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 1) dist = 1; // Prevent division by zero and very large forces
                    let force = (this.options.C / (dist * dist));
                    forces[key1].fx += force * dx / dist;
                    forces[key1].fy += force * dy / dist;
                }
            }
        }

        // Calculate attractive forces (Hooke's law)
        this.connections.forEach(conn => {
            let [key1, key2] = conn;
            let dx = this.nodes[key1].x - this.nodes[key2].x;
            let dy = this.nodes[key1].y - this.nodes[key2].y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            let force = this.options.K * (dist - this.options.minDist);
            forces[key1].fx -= force * dx / dist;
            forces[key1].fy -= force * dy / dist;
            forces[key2].fx += force * dx / dist;
            forces[key2].fy += force * dy / dist;
        });

        return forces;
    }

    _applyForces(forces) {
        for (let key in this.nodes) {
            this.nodes[key].vx = (this.nodes[key].vx + forces[key].fx) * this.options.damping;
            this.nodes[key].vy = (this.nodes[key].vy + forces[key].fy) * this.options.damping;
            
            const maxVelocity = 10;
            const velocity = Math.sqrt(this.nodes[key].vx ** 2 + this.nodes[key].vy ** 2);
            if (velocity > maxVelocity) {
                this.nodes[key].vx = (this.nodes[key].vx / velocity) * maxVelocity;
                this.nodes[key].vy = (this.nodes[key].vy / velocity) * maxVelocity;
            }
            
            this.nodes[key].x += this.nodes[key].vx;
            this.nodes[key].y += this.nodes[key].vy;
            
            this._constrainToBoundary(this.nodes[key]);
        }
    }

    _preventOverlap() {
        for (let key1 in this.nodes) {
            for (let key2 in this.nodes) {
                if (key1 !== key2) {
                    let node1 = this.nodes[key1];
                    let node2 = this.nodes[key2];
                    let dx = node1.x - node2.x;
                    let dy = node1.y - node2.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    let minDist = this.options.minDist;
                    if (dist < minDist) {
                        let angle = Math.atan2(dy, dx);
                        let moveDist = (minDist - dist) / 2;
                        node1.x += moveDist * Math.cos(angle);
                        node1.y += moveDist * Math.sin(angle);
                        node2.x -= moveDist * Math.cos(angle);
                        node2.y -= moveDist * Math.sin(angle);
                    }
                }
            }
        }
    }

    _constrainToBoundary(node) {
        const nodeWidth = node.width || this.options.defaultNodeWidth;
        const nodeHeight = node.height || this.options.defaultNodeHeight;
        const halfWidth = nodeWidth / 2;
        const halfHeight = nodeHeight / 2;
        const padding = this.options.containerPadding;
        
        node.x = Math.max(padding + halfWidth, Math.min(this.options.containerWidth - padding - halfWidth, node.x));
        node.y = Math.max(padding + halfHeight, Math.min(this.options.containerHeight - padding - halfHeight, node.y));
    }

    _drawGraph() {
        let container = document.getElementById(this.containerId);
        container.innerHTML = '';
        container.style.position = 'relative';
        container.style.width = `${this.options.containerWidth}px`;
        container.style.height = `${this.options.containerHeight}px`;
        container.style.border = '1px solid #ccc';
        container.style.boxSizing = 'border-box';
        container.style.padding = `${this.options.containerPadding}px`;

        for (let key in this.nodes) {
            let node = this.nodes[key];
            let nodeDiv = document.createElement('div');
            nodeDiv.id = node.id;
            nodeDiv.className = 'graph-node';
            nodeDiv.style.position = 'absolute';
            nodeDiv.style.left = `${node.x}px`;
            nodeDiv.style.top = `${node.y}px`;
            nodeDiv.style.transform = 'translate(-50%, -50%)';
            nodeDiv.style.backgroundColor = node.color || this.options.defaultNodeColor;
            nodeDiv.style.border = '1px solid #111';
            nodeDiv.style.width = `${node.width || this.options.defaultNodeWidth}px`;
            nodeDiv.style.height = `${node.height || this.options.defaultNodeHeight}px`;
            nodeDiv.style.display = 'flex';
            nodeDiv.style.flexDirection = 'column';
            nodeDiv.style.justifyContent = 'center';
            nodeDiv.style.alignItems = 'center';
            nodeDiv.style.textAlign = 'center';
            nodeDiv.style.userSelect = 'text';
            nodeDiv.style.cursor = node.link ? 'pointer' : 'default';
            nodeDiv.style.overflow = 'hidden';
            nodeDiv.style.boxSizing = 'border-box';

            let titleElement = document.createElement('div');
            titleElement.textContent = node.title || node.id;
            titleElement.style.fontWeight = 'bold';
            titleElement.style.fontSize = this.options.titleFontSize;
            titleElement.style.color = node.textColor || this.options.defaultTextColor;
            if (node.link) {
                titleElement.style.transition = 'color 0.3s, text-decoration 0.3s';
                nodeDiv.addEventListener('mouseover', () => {
                    titleElement.style.color = 'green';
                    titleElement.style.textDecoration = 'underline';
                });
                nodeDiv.addEventListener('mouseout', () => {
                    titleElement.style.color = node.textColor || this.options.defaultTextColor;
                    titleElement.style.textDecoration = 'none';
                });
            }
            nodeDiv.appendChild(titleElement);

            if (node.subtitle) {
                let subtitleElement = document.createElement('div');
                subtitleElement.textContent = node.subtitle;
                subtitleElement.style.fontSize = this.options.subtitleFontSize;
                subtitleElement.style.color = node.textColor || this.options.defaultTextColor;
                nodeDiv.appendChild(subtitleElement);
            }

            if (node.link) {
                this._addHoverEffect(nodeDiv, node);
            }

            container.appendChild(nodeDiv);
        }
    }

    _drawConnections() {
        let container = document.getElementById(this.containerId);
        let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.zIndex = '-1';
        container.appendChild(svg);

        this.connections.forEach((conn, index) => {
            let [id1, id2] = conn;
            let node1 = this.nodes[id1];
            let node2 = this.nodes[id2];

            let color = this.options.useColoredConnections ? this._getColor(index) : 'black';

            let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", node1.x);
            line.setAttribute("y1", node1.y);
            line.setAttribute("x2", node2.x);
            line.setAttribute("y2", node2.y);
            line.setAttribute("stroke", color);
            line.setAttribute("stroke-width", "2");
            svg.appendChild(line);
        });
    }

    _getColor(index) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
            '#98D8C8', '#F7DC6F', '#BB8FCE', '#82E0AA'
        ];
        return colors[index % colors.length];
    }

    _addHoverEffect(nodeDiv, node) {
        let hoverBox = document.createElement('div');
        hoverBox.style.display = 'none';
        hoverBox.style.position = 'absolute';
        hoverBox.style.backgroundColor = 'white';
        hoverBox.style.border = '1px solid #ccc';
        hoverBox.style.padding = '5px';
        hoverBox.style.borderRadius = '3px';
        hoverBox.style.zIndex = '1000';
        hoverBox.style.whiteSpace = 'nowrap';

        let icon = document.createElement('span');
        icon.style.marginRight = '5px';
        if (node.link.match(/\.(jpg|jpeg|png|gif|bmp|svg)$/i)) {
            icon.innerHTML = '🖼️';
        } else if (node.link.match(/\.pdf$/i)) {
            icon.innerHTML = '📄';
        } else {
            icon.innerHTML = '🌐';
        }

        let linkText = document.createElement('span');
        linkText.textContent = 'Click to open link';

        hoverBox.appendChild(icon);
        hoverBox.appendChild(linkText);

        nodeDiv.appendChild(hoverBox);

        nodeDiv.addEventListener('mouseover', () => {
            hoverBox.style.display = 'block';
            hoverBox.style.left = `${node.width || this.options.defaultNodeWidth}px`;
            hoverBox.style.top = '0px';
        });

        nodeDiv.addEventListener('mouseout', () => {
            hoverBox.style.display = 'none';
        });

        nodeDiv.addEventListener('click', (e) => {
            e.preventDefault();
            this._showDialog(node);
        });
    }

    _showDialog(node) {
        let content = this._createDialog();
        if (node.link.match(/\.(jpg|jpeg|png|gif|bmp|svg)$/i)) {
            let img = document.createElement('img');
            img.src = node.link;
            img.style.maxWidth = '100%';
            content.appendChild(img);
        } else if (node.link.match(/\.pdf$/i)) {
            let embed = document.createElement('embed');
            embed.src = node.link;
            embed.type = 'application/pdf';
            embed.style.width = '600px';
            embed.style.height = '600px';
            content.appendChild(embed);
        } else {
            let iframe = document.createElement('iframe');
            iframe.src = node.link;
            iframe.style.width = '600px';
            iframe.style.height = '600px';
            iframe.style.border = 'none';
            content.appendChild(iframe);
        }

        this.dialog.addEventListener('click', (e) => {
            if (e.target === this.dialog) {
                this._closeDialog();
            }
        });
    }

    _createDialog() {
        if (this.dialog) {
            document.body.removeChild(this.dialog);
        }
        this.dialog = document.createElement('div');
        this.dialog.style.position = 'fixed';
        this.dialog.style.left = '0';
        this.dialog.style.top = '0';
        this.dialog.style.width = '100%';
        this.dialog.style.height = '100%';
        this.dialog.style.backgroundColor = 'rgba(0,0,0,0.5)';
        this.dialog.style.display = 'flex';
        this.dialog.style.justifyContent = 'center';
        this.dialog.style.alignItems = 'center';
        this.dialog.style.zIndex = '1000';

        let content = document.createElement('div');
        content.style.backgroundColor = 'white';
        content.style.padding = '20px';
        content.style.borderRadius = '5px';
        content.style.maxWidth = '80%';
        content.style.maxHeight = '80%';
        content.style.overflow = 'auto';

        this.dialog.appendChild(content);
        document.body.appendChild(this.dialog);

        return content;
    }

    _closeDialog() {
        if (this.dialog) {
            document.body.removeChild(this.dialog);
            this.dialog = null;
        }
    }
}

class Node {
    constructor(id, title = '', subtitle = '', link = '', color = null, width = null, height = null) {
        this.id = id;
        this.title = title;
        this.subtitle = subtitle;
        this.link = link;
        this.color = color;
        this.width = width;
        this.height = height;
        this.x = null;
        this.y = null;
        this.vx = 0;
        this.vy = 0;
        this.textColor = null;
    }
}

// Example usage:
// const graph = new GraphViz('graph-container', { 
//     radialLevels: 3, 
//     defaultNodeColor: '#A0CFFC',
//     defaultNodeWidth: 100,
//     defaultNodeHeight: 40
// });
// graph.addNode('fruits', 'Fruits', 'Delicious!', 'https://en.wikipedia.org/wiki/Fruit', '#FF6347', 120, 60);
// graph.addNode('apple', 'Apple', 'Red fruit', 'https://example.com/apple.jpg');
// graph.addNode('banana', 'Banana', 'Yellow fruit', 'https://example.com/banana.pdf', '#FFD700');
// graph.addNode('orange', 'Orange', 'Orange fruit', 'https://example.com/orange.html');
// graph.addConnection('fruits', 'apple');
// graph.addConnection('fruits', 'banana');
// graph.addConnection('fruits', 'orange');
// graph.setNodeColor('orange', '#FFA500');
// graph.setNodeSize('banana', 150, 50);
// graph.titleFontSize('1.2em');
// graph.subtitleFontSize('0.8em');
// graph.nodeTextColor('apple', '#FF0000');
// graph.draw();