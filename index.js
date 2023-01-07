import MutationWorker from "./Classes/MutationWorker";
import ProxyCell from "./Classes/ProxyCell";
import NodePipeline from "./Classes/NodePipeline";
export default class AdaptiveGrid extends HTMLElement {

    rootNode;

    static gridSize = 12;
    static sizeSet = {
        'xs': 1,
        's': 3,
        'm': 6,
        'l': 9,
        'xl': 12,
    };

    // TODO: init ruleset inside init method
    ruleSet = {
        "positioning": [
            {
                "area": "right-top",
                "direction": "top-down",
                "affected": ".right-top" // any css Selector
            },
            {
                "area": "right-bottom",
                "direction": "down-top",
                "affected": ".right-bottom" // any css Selector
            },
        ],
    };
    reservations = [];
    areaMap = {
        "left-top": {"x": 0, "y": 0},
        "left-bottom": {"x": 0, "y": 'len'},
        "right-top": {"x": AdaptiveGrid.gridSize -1, "y": 0},
        "right-bottom": {"x": AdaptiveGrid.gridSize -1, "y": 'len'}
    }

    cellStorage = [];
    adaptiveGrid = new Array(new Array(AdaptiveGrid.gridSize));
    gridLayout = '';

    globalStyles = '';

    mutationAgent = new MutationWorker();
    nodePipeline = new NodePipeline(this);
    cellHeight;
    colGap;
    rowGap;
    width;
    cellHeightPuffer = 0;

    constructor(el) {
        // Always call super first in constructor
        super();
        this.rootNode = el;
    }

    /**
     * Returns an Array with all direct Child Elements
     */
    init(cellHeight = 20, colGap = 0, rowGap = 0, width = 'auto', ruleSet = {}) {
        this.cellHeight = cellHeight;
        this.colGap = colGap;
        this.rowGap = rowGap;
        this.width = width;

        const style = document.createElement("style");
        this.setGlobalStyles();
        style.textContent = this.globalStyles;

        this.rootNode.append(style);
        for (let i = 0; i < this.rootNode.children.length; i++) {
            const el = this.rootNode.children[i];
            this.nodePipeline.push(el, false, false)
        }
        this.build();
        this.mutationAgent.attach(this);
        this.mutationAgent.observeChildElements(this.rootNode, {
            attributes: false,
            characterData: false,
            childList: true,
            subtree: false,
            attributeOldValue: false,
            characterDataOldValue: false
        });
    }

    build() {
        this.mutationAgent.disconnectFromChildTreeChanges();
        this.fillCellStorage();
        this.clearAdaptiveGrid();
        this.setGridHeight();
        this.handleReservations();
        this.buildAdaptiveGrid();
        console.log(this.adaptiveGrid);
        this.setGlobalStyles();
        this.rootNode.querySelector('style').innerHTML = this.globalStyles;
        this.setGridDimensions();
        this.activateAdaptiveGridStyles();
        this.mutationAgent.observeChildTreeChanges(this.rootNode, {
            attributes: true,
            characterData: false,
            childList: false,
            subtree: true,
            attributeOldValue: false,
            characterDataOldValue: false
        });
    }

    /**
     * Climbs the DOM Tree up until it reaches the parent node this
     * @param node
     * @returns {*} returns the direct successor from this (adaptive-grid > *)
     */
    checkAncestor(node) {
        if (node.isEqualNode(this.rootNode)) return node;
        let ancestor = node;
        while (ancestor.parentNode != null && !ancestor.parentNode.isEqualNode(this.rootNode)) {
            ancestor = ancestor.parentNode;
        }
        return ancestor;
    }

    isDirectSuccessor(node) {
        return node.parentNode.isEqualNode(this.rootNode);
    }

    /**
     * Builds the adaptive Grid
     * If <adaptive-grid> has 16 direct child nodes, following two dimensional array would be created
     * [
     *   [1,2,3,4,5,6,7,8,9,10,11,12] // ProxyCells
     *   [13,14,15,16]
     * ]
     */
    fillCellStorage() {
        this.resetProxyState();
        const newNodes = this.nodePipeline.filter('STYLE');

        if (newNodes.length > 0) {
            // for each new Element, check if it already exists in the cell storage
            // if so, remove the proxycell and place a new one
            newNodes.forEach((child, index) => {
                const cHeight = child.clientHeight;
                const proxyCell = new ProxyCell(child.ref);

                // set col size
                if (child.dataset === undefined || child.dataset === null || child.dataset.sizeX === undefined ||
                    child.dataset.sizeX === null
                ) {
                    // proxyCell.colSpan = AdaptiveGrid.sizeSet['m'];
                    const containerWidth = this.rootNode.parentElement.clientWidth;
                    proxyCell.colSpan = Math.ceil(child.clientWidth / (containerWidth / AdaptiveGrid.gridSize));
                } else {
                    proxyCell.colSpan = AdaptiveGrid.sizeSet[`${child.dataset.sizeX}`];
                }
                proxyCell.size = cHeight;

                proxyCell.deleted = false;
                proxyCell.rowSpan = this.calculateRowSpan(proxyCell);

                // TODO: outsource in function
                if (!this.isEmpty(this.ruleSet)) {
                    // es muss geprüft werden, ob das Element Teilmenge des Rulesets ist
                    const rule = this.getRuleFor(proxyCell);
                    if (!this.isEmpty(rule)) {
                        if (rule.hasOwnProperty('area') && this.areaMap.hasOwnProperty(rule.area)) {
                            const coordinates = this.areaMap[rule.area];
                            proxyCell.posX = coordinates.x;
                            proxyCell.posY = coordinates.y === 'len' ? this.adaptiveGrid.length -1 :  coordinates.y;
                            this.reservations.push(proxyCell);
                            return;
                        }

                    }
                }
                this.cellStorage.push(proxyCell);
            });
        }
        const removedNodes = this.nodePipeline.removedNodes;
        if (removedNodes.length > 0) {
            removedNodes.forEach((child, index) => {
                let indexToRemove = this.reservations.findIndex(cell => cell.nodeRef === child);
                if (indexToRemove !== -1) {
                    this.reservations.splice(indexToRemove, 1);
                } else {
                    indexToRemove = this.cellStorage.findIndex(cell => cell.nodeRef === child);
                    this.cellStorage.splice(indexToRemove, 1);
                }
            });
        }
    }



    resetProxyState() {
        if (this.reservations.length > 0) {
            this.reservations.forEach((proxyCell, index) => {
                proxyCell.deleted = false;
            })
        }
        if (this.cellStorage.length > 0) {
            this.cellStorage.forEach((proxyCell, index) => {
                proxyCell.deleted = false;
            })
        }
    }

    setMinimumHeight() {
        if (this.cellStorage.length > 0) {
            this.cellStorage.forEach((proxyCell, index) => {
                const height = proxyCell.size;
                if (this.cellHeight === 0) this.cellHeight = height; // first element
                if (this.cellHeight > height) this.cellHeight = height;
            })
        }
    }

    setCellRowSpan() {
        for (let i = 0; i < this.cellStorage.length; i++) {
            const proxyCell = this.cellStorage[i];
            if (proxyCell === undefined) break;
            proxyCell.rowSpan = this.calculateRowSpan(proxyCell);
        }
    }

    calculateRowSpan(proxyCell) {
        if (Object.hasOwn(proxyCell, 'size')) {
            return Math.ceil(proxyCell.size / (this.cellHeight + this.rowGap)); // damit rowspan der eigentlichen Höhe entspricht
        }
        return 0;
    }

    handleReservations() {
        if (this.reservations.length > 0) {
            for (let i = 0; i < this.reservations.length; i++) {
                this.placeReservation(this.reservations[i]);
            }
        }
    }

    buildAdaptiveGrid() {
        if (this.cellStorage.length > 0) {
            for (let i = 0; i < this.cellStorage.length; i++) {
                this.placeCell();
            }
        }
    }

    getHighestCell() {
        if (this.cellStorage.length === 0) return null;
        const filteredCellStorage = this.cellStorage.filter(x => !x.deleted);
        let highestCell = filteredCellStorage[0];
        let pos = 0;
        for (let i = 0; i < filteredCellStorage.length; i++) {
            const proxyCell = filteredCellStorage[i];
            if (proxyCell === undefined) break;
            if (proxyCell.rowSpan > highestCell.rowSpan) {
                highestCell = proxyCell;
                pos = i;
            }
        }
        return highestCell;
    }

    getNextFreePosition() {
        let row = 0;
        let col = 0;

        while (col < this.adaptiveGrid[row].length) {
            while (row < this.adaptiveGrid.length) {
                if (this.adaptiveGrid[row][col] === null || this.adaptiveGrid[row][col] === undefined) {
                    return {"x": col, "y": row};
                }
                row++;
            }
            row = 0;
            col++;
        }

        this.adaptiveGrid.push(new Array(AdaptiveGrid.gridSize));
        return {"x": 0, "y": this.adaptiveGrid.length - 1};
    }

    placeCell() {
        const coordinates = this.getNextFreePosition();
        if (coordinates === undefined) return; // no more free space
        if (coordinates.x === 0 && coordinates.y === 0) { // initial call
            const highestProxyCell = this.getHighestCell();
            if (highestProxyCell === null) return;
            this.occupyGridCells(highestProxyCell, coordinates);
            return;
        }

        const desiredColSpan = this.getIdealColSpan(coordinates)
        const desiredRowSpan = this.getIdealRowSpan(coordinates);
        if (desiredRowSpan === this.adaptiveGrid.length) {
            const highestProxyCell = this.getHighestCell();
            if (highestProxyCell.colSpan > desiredColSpan) {
                for (let i = 0; i < highestProxyCell.rowSpan; i++) {
                    this.adaptiveGrid.push(new Array(AdaptiveGrid.gridSize));
                }
                coordinates.x = 0;
                coordinates.y = this.adaptiveGrid.length - highestProxyCell.rowSpan;
            }
            this.occupyGridCells(highestProxyCell, coordinates);
            return;
        }


        let desiredCell = undefined;
        let cols = desiredColSpan;
        while (desiredCell === undefined && cols > 0) {
            desiredCell = this.getDesiredCell(desiredRowSpan, desiredColSpan);
            cols--;
        }
        if (desiredCell !== undefined) {
            this.occupyGridCells(desiredCell, coordinates);
        } else {
            desiredCell = this.getHighestCell();
            for (let i = 0; i < desiredCell.rowSpan; i++) {
                this.adaptiveGrid.push(new Array(AdaptiveGrid.gridSize));
            }
            coordinates.x = 0;
            coordinates.y = this.adaptiveGrid.length - desiredCell.rowSpan;
            this.occupyGridCells(desiredCell, coordinates);
        }

        // no -> new container
    }

    isEmpty(object) {
        return Object.keys(object).length === 0;
    }

    setGridHeight() {
        let highestCell;
        if (this.reservations.length !== 0) {
            const filteredReservations = this.reservations.filter(x => !x.deleted);
            highestCell = filteredReservations[0];
            for (let i = 0; i < filteredReservations.length; i++) {
                const proxyCell = filteredReservations[i];
                if (proxyCell === undefined) break;
                if (proxyCell.rowSpan > highestCell.rowSpan) {
                    highestCell = proxyCell;
                }

            }
        }

        if (this.cellStorage.length !== 0) {
            const filteredCellStorage = this.cellStorage.filter(x => !x.deleted);
            if ( highestCell === undefined) {
                highestCell = filteredCellStorage[0];
            }
            for (let i = 0; i < filteredCellStorage.length; i++) {
                const proxyCell = filteredCellStorage[i];
                if (proxyCell === undefined) break;
                if (proxyCell.rowSpan > highestCell.rowSpan) {
                    highestCell = proxyCell;
                }
            }

        }

        if (highestCell === undefined) return null;

        for (let i = 1; i < highestCell.rowSpan; i++) {
            this.adaptiveGrid.push(new Array(AdaptiveGrid.gridSize));
        }
        if (!this.isEmpty(this.ruleSet) && this.reservations.length !== 0) {
            const filteredReservations = this.reservations.filter(x => !x.deleted);
            for (let i = 0; i < filteredReservations.length; i++) {
                const proxyCell = filteredReservations[i];
                // TODO: outsource in function
                const rule = this.getRuleFor(proxyCell);
                if (!this.isEmpty(rule)) {
                    if (rule.hasOwnProperty('area') && this.areaMap.hasOwnProperty(rule.area)) {
                        const coordinates = this.areaMap[rule.area];
                        proxyCell.posY = coordinates.y === 'len' ? this.adaptiveGrid.length:  coordinates.y;
                    }
                }
            }
        }

    }

    // left-top Iteration
    occupyGridCells(proxyCell, coordinates) {
        proxyCell.posX = coordinates.x;
        proxyCell.posY = coordinates.y;
        proxyCell.deleted = true;
        for (let i = proxyCell.posX; i < proxyCell.posX + proxyCell.colSpan; i++) {
            for (let j = proxyCell.posY; j < proxyCell.posY + proxyCell.rowSpan; j++) {
                this.adaptiveGrid[j][i] = proxyCell;
            }
        }
        proxyCell.setAttributes(this.adaptiveGrid);
    }


    // intelligent alg
    placeReservation(proxyCell) {
        proxyCell.deleted = true;
        let startX = 0;
        let startY = proxyCell.posY;
        if (proxyCell.posX + proxyCell.colSpan > AdaptiveGrid.gridSize - 1) {
            startX = proxyCell.posX - proxyCell.colSpan;
        }

        if (proxyCell.posY + proxyCell.rowSpan > this.adaptiveGrid.length) {
            startY = proxyCell.posY - proxyCell.rowSpan;
        }

        for (let i = startX; i < startX + proxyCell.colSpan; i++) {
            for (let j = startY; j < startY + proxyCell.rowSpan; j++) {
                this.adaptiveGrid[j][i] = proxyCell;
            }
        }
        proxyCell.setAttributes(this.adaptiveGrid);
    }

    // Todo: funktioniert nicht
    logGridGutter() {
        for (let i = 0; i < this.adaptiveGrid.length; i++) {
            for (let j = 0; j < this.adaptiveGrid[i].length; j++) {
                const proxyCell = this.adaptiveGrid[i][j];
                if (proxyCell === undefined) {
                    this.gridLayout += 'NaN' + '     | ';
                } else if (proxyCell.nodeRef.dataset.sizeX === undefined) {
                    this.gridLayout += 'IV ' + '     | '
                } else {
                    let filler = '';
                    if (proxyCell.nodeRef.dataset.sizeX[0] !== 'x') filler = filler + ' '
                    if (parseInt(proxyCell.rowSpan) < 10) filler = filler + ' ';
                    this.gridLayout += proxyCell.nodeRef.dataset.sizeX + ' - ' + proxyCell.rowSpan + filler + ' | ';
                }
            }
            this.gridLayout += '\n';
        }

        console.log(this.gridLayout)
    }

    getIdealRowSpan(coordinates) {
        return this.adaptiveGrid.length - coordinates.y;
    }

    getIdealColSpan(coordinates) {
        return AdaptiveGrid.gridSize - coordinates.x;
    }

    getDesiredCell(desiredRowSpan, desiredColSpan) {
        let desiredCell = undefined;
        for (let i = desiredRowSpan; i > 0; i--) {
            for (let j = desiredColSpan; j > 0; j--) {
                desiredCell = this.cellStorage.find(cell => (cell.rowSpan === i && cell.colSpan === j && !cell.deleted))
                if (desiredCell !== undefined) break;
            }
            if (desiredCell !== undefined) break;
        }
        return desiredCell;
    }

    setGlobalStyles() {
        let style = `
        
        adaptive-grid > * {
          -webkit-box-sizing: border-box;
          -moz-box-sizing: border-box;
          box-sizing: border-box;
          overflow-x: scroll;
        }
        
       adaptive-grid [data-size-x="xs"],
        adaptive-grid .size-xs {
            width: 8.333%; 
        }
        
        adaptive-grid [data-size-x="s"],
        adaptive-grid .size-s {
            width: 24.999%;
        }
        
        adaptive-grid [data-size-x=""m],
        adaptive-grid .size-m {
            width: 49.998%;
        }
        
        adaptive-grid [data-size-x="l"],
        adaptive-grid .size-l {
            width: 74.997%;
        }
        
        adaptive-grid [data-size-x="xl"],
        adaptive-grid .size-xl {
            width: 100%;
        }
        
        [data-adaptive-grid-active="true"] {
            display: grid;
            
            grid-template-columns: repeat(${AdaptiveGrid.gridSize}, calc(8.333% - ${this.colGap}px));
            
            grid-template-rows: repeat(${this.adaptiveGrid.length}, ${this.cellHeight}px);  
            grid-auto-flow: dense;
            grid-column-gap: ${this.colGap}px;
            grid-row-gap: ${this.rowGap}px;
        }
        
        [data-adaptive-grid-active="true"] > * {
            width: auto !important;
        }
        `

        for (let i = 1; i <= AdaptiveGrid.gridSize; i++) {
            style += `[data-g-c-start="${i}"] { grid-column-start: ${i}}`;  // posX
            style += `[data-g-c-end="${i}"] { grid-column-end: span ${i}}`;      // colSpan
        }


        for (let i = 1; i <= this.adaptiveGrid.length; i++) {
            style += `[data-g-r-start="${i}"] { grid-row-start: ${i}}`;  // posY
            style += `[data-g-r-end="${i}"] { grid-row-end: span ${i}}`; // rowSpan
        }

        this.globalStyles = style;
    }

    setGridDimensions() {
        this.rootNode.dataset.adaptiveGridRowCount = this.adaptiveGrid.length.toString();
    }

    activateAdaptiveGridStyles() {
        this.rootNode.dataset.adaptiveGridActive = "true";
        console.log('activate em', this.rootNode.dataset.adaptiveGridActive)
    }

    clearAdaptiveGrid() {
        this.gridLayout = '';
        // this.newNodePipeline = [];
        this.nodePipeline.clear();
        // this.removingNodePipeline = [];
        this.adaptiveGrid = new Array(new Array(AdaptiveGrid.gridSize)); // TODO: muss optimiert werden. Es soll nicht immer das ganze Grid neu gebuildet werden
    }

    getRuleFor(proxyCell) {
        // TODO: Dynamic search func
        const node = proxyCell.nodeRef;
        if (node.classList.contains('right-top')) {
            return {
                "area": "right-top",
                "direction": "top-down",
                "affected": ".right-top" // only classes
            }
        }

        return {};
    }
}

// Define the new element
customElements.define('adaptive-grid', AdaptiveGrid);