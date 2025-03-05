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
            useColoredConnections: true,
            containerWidth: 800,
            containerHeight: 600,
            containerPadding: 10,
            titleFontSize: '0.9em',
            subtitleFontSize: '0.7em',
            levelCoef: 1.02,
            levelOffset: 50,
            highlightDependencies: true,  
            highlightColor: '#FF0000',  
            ...options
        };
        this.nodes = {};
        this.connections = [];
        this.dependencies = [];
        this.isPositionsCalculated = false;
        this.dialog = null;
        this.levels = [];
        this.dependencies = new Map();
        this.relations = new Set(); // set to store simple relations
        this._initMenuControls();
        
    }

    addNode(id, title = '', subtitle = '', link = '', color = null, width = null, height = null) {
        if (!this.nodes[id]) {
            this.nodes[id] = new Node(id, title, subtitle, link, color, width, height);
            this.dependencies.set(id, new Set()); // Initialize empty set for dependencies
        }
    }

    addDependency(childId, parentIds) {
        if (Array.isArray(parentIds)) {
            parentIds.forEach(parentId => this._addSingleDependency(childId, parentId));
        } else {
            this._addSingleDependency(childId, parentIds);
        }
    }

    _addSingleDependency(childId, parentId) { // new private method that contains the original logic for adding a single dependency.
        if (this.nodes[childId] && this.nodes[parentId]) {
            this.dependencies.get(childId).add(parentId);
            this.addConnection(childId, parentId);
        } else {
            console.warn(`Cannot add dependency: one or both nodes do not exist.`);
        }
    }

    addRelation(nodeId1, nodeId2) {
        if (Array.isArray(nodeId2)) {
            nodeId2.forEach(id => this._addSingleRelation(nodeId1, id));
        } else {
            this._addSingleRelation(nodeId1, nodeId2);
        }
    }

    // new private method that contains the original logic for adding a single relation.
    _addSingleRelation(nodeId1, nodeId2) {
        if (this.nodes[nodeId1] && this.nodes[nodeId2]) {
            // Store the relation as a set of two node IDs
            this.relations.add(JSON.stringify([nodeId1, nodeId2].sort()));
        } else {
            console.warn(`Cannot add relation: one or both nodes do not exist.`);
        }
    } 

    toggleHighlightDependencies(enable) {
        this.options.highlightDependencies = enable;
        this.draw();  // Redraw the graph to apply changes
    }

    addNode(id, title = '', subtitle = '', link = '', color = null, width = null, height = null, dependencies = []) {
        if (!this.nodes[id]) {
            this.nodes[id] = new Node(id, title, subtitle, link, color, width, height);
            this.dependencies.set(id, new Set()); // Initialize empty set for dependencies
            dependencies.forEach(depId => {
                if (this.nodes[depId]) {
                    this.addDependency(id, depId);
                } else {
                    console.warn(`Dependency node with id '${depId}' does not exist.`);
                }
            });
        }
    }

    addConnection(id1, id2) {
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
            this.isPositionsCalculated = true;
        }
        this._drawGraph();
        this._drawConnections();
    }

    _calculateLevels() {
        const nodeIds = Object.keys(this.nodes);
        const childMap = new Map(nodeIds.map(id => [id, []]));
        
        this.dependencies.forEach((parents, childId) => {
            parents.forEach(parentId => {
                childMap.get(parentId).push(childId);
            });
        });
    
        // Initialize all nodes with level 0
        nodeIds.forEach(id => {
            this.nodes[id].level = 0;
        });
    
        let unassigned = nodeIds;
        let changed = true;
        const maxIterations = nodeIds.length;
        let iteration = 0;
    
        while (changed && iteration < maxIterations) {
            changed = false;
            iteration++;
    
            unassigned.forEach(nodeId => {
                const parentLevels = Array.from(this.dependencies.get(nodeId))
                    .map(parentId => this.nodes[parentId].level);
                
                if (parentLevels.length > 0) {
                    const maxParentLevel = Math.max(...parentLevels);
                    if (this.nodes[nodeId].level <= maxParentLevel) {
                        this.nodes[nodeId].level = maxParentLevel + 1;
                        changed = true;
                    }
                }
            });
        }
    
        if (iteration === maxIterations) {
            console.warn("Maximum iterations reached. There might be circular dependencies.");
        }
    
        // Group nodes by their calculated levels
        this.levels = [];
        nodeIds.forEach(id => {
            const level = this.nodes[id].level;
            if (!this.levels[level]) {
                this.levels[level] = [];
            }
            this.levels[level].push(id);
        });
    }

    _initializePositions() {
        this._calculateLevels();
        const containerHeight = this.options.containerHeight - 2 * this.options.containerPadding;
        const containerWidth = this.options.containerWidth - 2 * this.options.containerPadding;
        const levelHeight = containerHeight / (this.levels.length || 1);

        this.levels.forEach((level, levelIndex) => {
            const nodesInLevel = level.length;
            level.forEach((nodeId, nodeIndex) => {
                const node = this.nodes[nodeId];
                node.x = this.options.containerPadding + ((nodeIndex + 1) / (nodesInLevel + 1)) * containerWidth;
                node.y = this.options.containerPadding + (levelIndex + 0.5) * levelHeight;
            });
        });

        // Apply levelOffset and levelCoef
        this._applyLevelOffsetAndCoef();
    }

    _applyLevelOffsetAndCoef() {
        const levelOffset = this.options.levelOffset;
        const levelCoef = this.options.levelCoef;

        this.dependencies.forEach((parents, childId) => {
            const child = this.nodes[childId];
            parents.forEach(parentId => {
                const parent = this.nodes[parentId];
                // Ensure child is below parent
                child.y = Math.max(child.y, parent.y + levelOffset);
                // Center child horizontally relative to parent
                child.x = parent.x + (child.x - parent.x) / levelCoef;
            });
        });
    }

    _updatePositions() {
        for (let i = 0; i < this.options.iterations; i++) {
            this._applyForces();
            this._applyLevelOffsetAndCoef(); // Apply after each iteration
            this._preventOverlap();
        }
    }

    _calculateForces() {
        let forces = {};
        for (let key in this.nodes) {
            forces[key] = { fx: 0, fy: 0 };
        }

        // Repulsive forces
        for (let key1 in this.nodes) {
            for (let key2 in this.nodes) {
                if (key1 !== key2) {
                    let dx = this.nodes[key1].x - this.nodes[key2].x;
                    let dy = this.nodes[key1].y - this.nodes[key2].y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 1) dist = 1;
                    let force = (this.options.C / (dist * dist)) * 0.5; // Reduced repulsive force
                    forces[key1].fx += force * dx / dist;
                    forces[key1].fy += force * dy / dist;
                }
            }
        }

        // Attractive forces
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

    _applyForces() {
        const forces = this._calculateForces();
        for (let key in this.nodes) {
            const node = this.nodes[key];
            const force = forces[key];
            
            // Apply force with dampening
            node.vx = (node.vx + force.fx) * this.options.damping;
            node.vy = (node.vy + force.fy) * this.options.damping;
            
            // Update position
            node.x += node.vx;
            node.y += node.vy;
            
            // Constrain to boundary
            this._constrainToBoundary(node);
        }
    }

    _applyLevelConstraints() {
        const levelHeight = this.options.containerHeight / (this.levels.length || 1);
        this.levels.forEach((level, levelIndex) => {
            const targetY = this.options.containerPadding + (levelIndex + 0.5) * levelHeight;
            level.forEach(nodeId => {
                const node = this.nodes[nodeId];
                const yDiff = targetY - node.y;
                node.y += yDiff * 0.1; // Gradual vertical adjustment
            });
        });
    }

   _applyDependencyForces() {
        const levelCoef = this.options.levelCoef;
        const levelOffset = this.options.levelOffset;

        this.dependencies.forEach((parents, childId) => {
            const child = this.nodes[childId];
            parents.forEach(parentId => {
                const parent = this.nodes[parentId];
                const targetY = parent.y + levelOffset;
                const yDiff = child.y - targetY;
                
                // Apply vertical force
                if (Math.abs(yDiff) > 1) {
                    const force = levelCoef * yDiff * 0.1; // Reduced force for smoother movement
                    child.y -= force;
                }

                // Apply horizontal centering force
                const xDiff = child.x - parent.x;
                if (Math.abs(xDiff) > 1) {
                    const force = levelCoef * xDiff * 0.05; // Reduced horizontal force
                    child.x -= force;
                }

                // Ensure child is below parent
                if (child.y <= parent.y) {
                    child.y = parent.y + levelOffset;
                }
            });
        });
    }

    _preventOverlap() {
        const nodeSpacing = Math.min(this.options.minDist, this.options.defaultNodeWidth * 1.2);
        
        for (let key1 in this.nodes) {
            for (let key2 in this.nodes) {
                if (key1 !== key2) {
                    let node1 = this.nodes[key1];
                    let node2 = this.nodes[key2];
                    let dx = node1.x - node2.x;
                    let dy = node1.y - node2.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < nodeSpacing) {
                        let angle = Math.atan2(dy, dx);
                        let moveDist = (nodeSpacing - dist) / 2;
                        node1.x += moveDist * Math.cos(angle);
                        node1.y += moveDist * Math.sin(angle);
                        node2.x -= moveDist * Math.cos(angle);
                        node2.y -= moveDist * Math.sin(angle);
                        
                        this._constrainToBoundary(node1);
                        this._constrainToBoundary(node2);
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
        
        node.x = Math.max(this.options.containerPadding + halfWidth, 
                  Math.min(this.options.containerWidth - this.options.containerPadding - halfWidth, node.x));
        node.y = Math.max(this.options.containerPadding + halfHeight, 
                  Math.min(this.options.containerHeight - this.options.containerPadding - halfHeight, node.y));
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

        for (let nodeId in this.nodes) {
            let node = this.nodes[nodeId];
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
            nodeDiv.style.userSelect = 'none';
            nodeDiv.style.cursor = node.link ? 'pointer' : 'default';
            nodeDiv.style.overflow = 'hidden';
            nodeDiv.style.boxSizing = 'border-box';
            nodeDiv.style.zIndex = '1';

            let titleElement = document.createElement('div');
            titleElement.textContent = node.title || node.id;
            titleElement.style.fontWeight = 'bold';
            titleElement.style.fontSize = this.options.titleFontSize;
            titleElement.style.color = node.textColor || this.options.defaultTextColor;
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

            if (this.options.highlightDependencies) {
                nodeDiv.addEventListener('mouseover', () => this._highlightDependencies(nodeId));
                nodeDiv.addEventListener('mouseout', () => this._unhighlightDependencies());
            }

            container.appendChild(nodeDiv);
        }
    }

    _highlightDependencies(nodeId) {
        const nodesToHighlight = new Set();
        const edgesToHighlight = new Set();

        // Only collect direct dependencies
        this.dependencies.get(nodeId).forEach(parentId => {
            nodesToHighlight.add(parentId);
            edgesToHighlight.add(JSON.stringify([nodeId, parentId]));
        });

        // Highlight nodes
        nodesToHighlight.forEach(id => {
            const nodeElement = document.getElementById(id);
            if (nodeElement) {
                nodeElement.style.boxShadow = `0 0 10px ${this.options.highlightColor}`;
            }
        });

        // Highlight edges
        const svg = document.querySelector(`#${this.containerId} svg`);
        svg.querySelectorAll('line').forEach(line => {
            const x1 = line.getAttribute('x1');
            const y1 = line.getAttribute('y1');
            const x2 = line.getAttribute('x2');
            const y2 = line.getAttribute('y2');

            edgesToHighlight.forEach(edge => {
                const [from, to] = JSON.parse(edge);
                const fromNode = this.nodes[from];
                const toNode = this.nodes[to];

                if (fromNode.x === parseFloat(x1) && fromNode.y === parseFloat(y1) &&
                    toNode.x === parseFloat(x2) && toNode.y === parseFloat(y2)) {
                    line.setAttribute('stroke', this.options.highlightColor);
                    line.setAttribute('stroke-width', '3');
                }
            });
        });
    }

    _unhighlightDependencies() {
        // Reset node highlighting
        Object.values(this.nodes).forEach(node => {
            const nodeElement = document.getElementById(node.id);
            if (nodeElement) {
                nodeElement.style.boxShadow = 'none';
            }
        });

        // Reset edge highlighting
        const svg = document.querySelector(`#${this.containerId} svg`);
        let colorIndex = 0;
        svg.querySelectorAll('line').forEach(line => {
            // Check if this is a relation line (dashed)
            const isDashed = line.getAttribute('stroke-dasharray');
            if (isDashed) {
                // Relations stay gray
                line.setAttribute('stroke', 'gray');
                line.setAttribute('stroke-width', '1');
            } else {
                // Get the original color back
                const originalColor = this.options.useColoredConnections ? this._getColor(colorIndex++) : 'black';
                line.setAttribute('stroke', originalColor);
                line.setAttribute('stroke-width', '2');
            }
        });
    }

    _drawConnections() { 
        let container = document.getElementById(this.containerId); 
        let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); 
        svg.style.position = 'absolute'; 
        svg.style.top = '0'; 
        svg.style.left = '0'; 
        svg.style.width = '100%'; 
        svg.style.height = '100%'; 
        svg.style.zIndex = '0'; // Keep the SVG below the nodes
        container.appendChild(svg); 
    
        // Store the original colors as data attributes 
        let colorIndex = 0; 
        this.dependencies.forEach((parentIds, childId) => { 
            parentIds.forEach(parentId => { 
                let color = this.options.useColoredConnections ? this._getColor(colorIndex++) : 'black'; 
                this._drawConnection(svg, childId, parentId, color, 2); 
            }); 
        }); 
    
        // Draw simple relations 
        this.relations.forEach(relationJson => { 
            const [id1, id2] = JSON.parse(relationJson); 
            this._drawConnection(svg, id1, id2, 'gray', 1, [5, 5]); // Relation lines (dashed) 
        }); 
    }

    _drawConnection(svg, id1, id2, color, width, dashArray = null) {
        let node1 = this.nodes[id1];
        let node2 = this.nodes[id2];

        let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", node1.x);
        line.setAttribute("y1", node1.y);
        line.setAttribute("x2", node2.x);
        line.setAttribute("y2", node2.y);
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", width);
        if (dashArray) {
            line.setAttribute("stroke-dasharray", dashArray.join(','));
        }
        // Store the original color as a data attribute
        line.setAttribute("data-original-color", color);
        svg.appendChild(line);
    }

    _getColor(index) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
            '#98D8C8', '#F7DC6F', '#BB8FCE', '#82E0AA'
        ];
        return colors[index % colors.length];
    }
    
    toggleColoredConnections(useColors) {
        this.options.useColoredConnections = useColors;
        this.draw();
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
    
        let linkText = document.createElement('span');
        linkText.textContent = 'Click to open link';
    
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
            if (node.link) {
                window.open(node.link, '_blank');
            }
        });
    }
    _initMenuControls() {
        // Add the menu toggle button
        const toggleButton = document.createElement('button');
        toggleButton.id = 'toggleMenu';
        toggleButton.textContent = 'Settings';
        toggleButton.style.position = 'fixed';
        toggleButton.style.top = '10px';
        toggleButton.style.right = '10px';
        toggleButton.style.zIndex = '1000';
        document.body.appendChild(toggleButton);
    
        // Add the menu container
        const menu = document.createElement('div');
        menu.id = 'optionsMenu';
        menu.style.display = 'none';
        menu.style.position = 'fixed';
        menu.style.top = '10px';
        menu.style.right = '10px';
        menu.style.width = '300px';
        menu.style.background = '#f9f9f9';
        menu.style.border = '1px solid #ccc';
        menu.style.padding = '10px';
        menu.style.borderRadius = '5px';
        menu.style.zIndex = '1000';
        menu.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3>Settings</h3>
                <button id="closeMenu" style="background: none; border: none; color: #999; font-size: 1.2em; cursor: pointer;">&times;</button>
            </div>
            <label>Container Height: <input type="number" id="containerHeight" value="${this.options.containerHeight}" /></label><br />
            <label>Container Width: <input type="number" id="containerWidth" value="${this.options.containerWidth}" /></label><br />
            <label>Node Height: <input type="number" id="nodeHeight" value="${this.options.defaultNodeHeight}" /></label><br />
            <label>Node Width: <input type="number" id="nodeWidth" value="${this.options.defaultNodeWidth}" /></label><br />
            <label>Node Text Color: <input type="color" id="nodeTextColor" value="${this.options.defaultTextColor}" /></label><br />
            <label>Node Color: <input type="color" id="nodeColor" value="${this.options.defaultNodeColor}" /></label><br />
            <label>Title Size: <input type="number" id="titleSize" value="${parseFloat(this.options.titleFontSize)}" /></label><br />
            <label>Subtitle Size: <input type="number" id="subtitleSize" value="${parseFloat(this.options.subtitleFontSize)}" /></label><br />
            <label>
                <input type="checkbox" id="coloredConnectionLines" ${this.options.useColoredConnections ? 'checked' : ''} /> Colored Connection Lines
            </label><br />
            <label>
                <input type="checkbox" id="highlightDependencies" ${this.options.highlightDependencies ? 'checked' : ''} /> Highlight Dependencies
            </label><br />
            <label>Highlight Color: <input type="color" id="highlightColor" value="${this.options.highlightColor}" /></label><br />
            <label>Level Coefficient (levelCoef): <input type="number" step="0.01" id="levelCoef" value="${this.options.levelCoef}" /></label><br />
            <label>Level Offset: <input type="number" id="levelOffset" value="${this.options.levelOffset}" /></label><br />
            <button id="applySettings">Apply</button>
`       ;

        document.body.appendChild(menu);
    
        // Event listener to toggle the menu
        toggleButton.addEventListener('click', () => {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        });
    
        // Event listener for the close button
        document.getElementById('closeMenu').addEventListener('click', () => {
            menu.style.display = 'none';
        });
    
        // Event listener to apply settings
        document.getElementById('applySettings').addEventListener('click', () => {
            this.isPositionsCalculated = false;  // Ensures new layout calculations
            this.options.containerHeight = parseInt(document.getElementById('containerHeight').value, 10);
            this.options.containerWidth = parseInt(document.getElementById('containerWidth').value, 10);
            this.options.defaultNodeHeight = parseInt(document.getElementById('nodeHeight').value, 10);
            this.options.defaultNodeWidth = parseInt(document.getElementById('nodeWidth').value, 10);
            this.options.defaultTextColor = document.getElementById('nodeTextColor').value;
            this.options.defaultNodeColor = document.getElementById('nodeColor').value;
            this.options.titleFontSize = document.getElementById('titleSize').value + 'em';
            this.options.subtitleFontSize = document.getElementById('subtitleSize').value + 'em';
            this.options.useColoredConnections = document.getElementById('coloredConnectionLines').checked;
            this.options.highlightDependencies = document.getElementById('highlightDependencies').checked;
            this.options.highlightColor = document.getElementById('highlightColor').value;  // New highlight color
            this.options.levelCoef = parseFloat(document.getElementById('levelCoef').value);  // New levelCoef
            this.options.levelOffset = parseInt(document.getElementById('levelOffset').value, 10);  // New levelOffset
        
            // Recalculate positions with updated settings
            this._initializePositions();  // Recalculate positions
            this.draw();  // Redraw the graph with new layout
            alert('Settings applied!');
        });
        
    }   
    
    /**
     * Create a graph from a YAML string
     * @param {string} yamlString - YAML formatted string to generate the graph
     */
    createGraphFromYAML(yamlString) {
        try {
            const yamlData = YAML.parse(yamlString);  // Parse YAML to JS object
            
            // Add nodes from YAML
            if (yamlData.nodes) {
                yamlData.nodes.forEach(node => {
                    this.addNode(
                        node.id,
                        node.title || '',
                        node.subtitle || '',
                        node.link || '',
                        node.color || null,
                        node.width || null,
                        node.height || null,
                        node.dependencies || []
                    );
                });
            }

            // Add dependencies from YAML
            if (yamlData.dependencies) {
                yamlData.dependencies.forEach(dep => {
                    this.addDependency(dep.child, dep.parents);
                });
            }

            // Draw the graph
            this.draw();

        } catch (error) {
            console.error('Error parsing YAML:', error);
        }
    }
    
}
// Export the gragafa class 
export{gragafa};

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
        this.level = 0;
    }
}
