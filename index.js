import MutationWorker from "./Classes/MutationWorker";
import ProxyCell from "./Classes/ProxyCell";
import NodePipeline from "./Classes/NodePipeline";
export class AdaptiveGrid extends HTMLElement {

    areaMap = {};
    ruleSet = {};
    rootNode;
    rowCount = 1;
    static gridSize = 12;
    static sizeSet = {
        'xs': 1,
        's': 3,
        'm': 6,
        'l': 9,
        'xl': 12,
    };
    reservations = [];
    cellStorage = [];
    adaptiveGrid = new Array(new Array(AdaptiveGrid.gridSize));
    register = [];
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
    init(cellHeight = 20, colGap = 0, rowGap = 0, width = 'auto', areaMap, ruleSet) {
        this.cellHeight = cellHeight;
        this.colGap = colGap;
        this.rowGap = rowGap;
        this.width = width;
        this.areaMap = areaMap;
        this.ruleSet = ruleSet
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
        console.log('build')
        console.log('this.ruleSet', this.ruleSet)

        this.mutationAgent.disconnectFromChildTreeChanges();
        this.fillCellStorage();
        this.clearAdaptiveGrid();
        this.setGridHeight();
        this.handleReservations();
        this.buildAdaptiveGrid();
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
                const containerWidth = this.rootNode.parentElement.clientWidth;
                proxyCell.colSpan = Math.ceil(child.clientWidth / (containerWidth / AdaptiveGrid.gridSize));
                proxyCell.size = cHeight;

                proxyCell.deleted = false;
                proxyCell.rowSpan = this.calculateRowSpan(proxyCell);

                // TODO: outsource in function
                if (!this.isEmpty(this.ruleSet)) {
                    // es muss geprüft werden, ob das Element Teilmenge des Rulesets ist
                    const rule = this.getRuleFor(proxyCell);
                    if (!this.isEmpty(rule)) {
                        proxyCell.rule = rule;
                        const finalProxyCell = proxyCell.processRules(this.areaMap, this.rowCount);
                        if (finalProxyCell.posY !== undefined) {
                            this.reservations.push(finalProxyCell);
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
                proxyCell.setCoordinates(undefined, undefined);
            })
        }
        if (this.cellStorage.length > 0) {
            this.cellStorage.forEach((proxyCell, index) => {
                proxyCell.deleted = false;
                proxyCell.setCoordinates(undefined, undefined);
            })
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
                const proxyCell = this.reservations[i];
                this.placeRes(proxyCell);
            }
        }
    }

    buildAdaptiveGrid() {
        if (this.cellStorage.length > 0) {
            for (let i = 0; i < this.cellStorage.length; i++) {
                this.placeCell();
            }
            console.log('register', this.register)
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

    getNextFreePositionFromRegister(elementToPlace) {
        // important for reservations
        let y = elementToPlace.posY === undefined ? 0 : elementToPlace.posY;
        let x = elementToPlace.posY === undefined ? 0 : elementToPlace.posX;
        for (let posY = y; posY < this.rowCount; posY++) {
            for (let posX = x; posX + elementToPlace.colSpan - 1 < AdaptiveGrid.gridSize; posX++) {
                const elementsOverlap = this.register.filter(el => {
                    //what elements are even relevant
                    //If the element to place does not reach the element with its colspan && rowSpan, it is not relevant.

                    // el.x = 0   el.y = 2     el.colS = 1    el.
                    // posX = 0   posY = 0     colSpan = 3    rowSpan = 2

                    if ((el.x > posX + elementToPlace.colSpan - 1) || (el.y > posY + elementToPlace.rowSpan - 1)) return false;
                    //What elements come in the way of this position
                    //Does the Element shit in from left

                    if (el.x + el.colSpan - 1 >= posX && el.y + el.rowSpan - 1 >= posY) return true;
                    return false;
                });
                if (elementsOverlap.length === 0) {
                    if (posY + elementToPlace.rowSpan - 1 > this.rowCount - 1) {
                        return false;
                    }
                    return {"x": posX, "y": posY};
                }
            }
        }
        return false;
    }

    placeCell() {
        const proxyCell = this.getHighestCell();
        let coordinates = this.getNextFreePositionFromRegister(proxyCell);
        console.log('coordinates', coordinates)
        if (coordinates !== false) {
            proxyCell.setCoordinates(coordinates.x, coordinates.y);
            this.register.push({
                "x": coordinates.x,
                "y": coordinates.y,
                "colSpan": proxyCell.colSpan,
                "rowSpan": proxyCell.rowSpan,
                "isReservation": false,
                "proxyCell": proxyCell,
            });
        } else {
            this.rowCount += proxyCell.rowSpan;
            console.log('rowCount', this.rowCount)
            const registeredReservations = this.register.filter((el) => el.isReservation);
            this.register = this.register.filter(el => !el.isReservation);
            registeredReservations.forEach(el => {
                el.proxyCell.processRules(this.areaMap, this.rowCount);
                this.placeRes(el.proxyCell);
            });
            let coordinates = this.getNextFreePositionFromRegister(proxyCell);
            proxyCell.setCoordinates(coordinates.x, coordinates.y);
            this.register.push({
                "x": coordinates.x,
                "y": coordinates.y,
                "colSpan": proxyCell.colSpan,
                "rowSpan": proxyCell.rowSpan,
                "isReservation": false,
                "proxyCell": proxyCell
            });
        }
        proxyCell.setAttributes();
    }

    placeRes(proxyCell) {
        let coordinates = this.getNextFreePositionFromRegister(proxyCell);
        this.register.push({
            "x": coordinates.x,
            "y": coordinates.y,
            "colSpan": proxyCell.colSpan,
            "rowSpan": proxyCell.rowSpan,
            "isReservation": true,
            "proxyCell": proxyCell
        });
        proxyCell.setAttributes();
    }


    isEmpty(object) {
        return this.ruleSet === undefined || Object.keys(object).length === 0;
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
            if (highestCell === undefined) {
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
        this.rowCount = this.rowCount + highestCell.rowSpan - 1;


        if (!this.isEmpty(this.ruleSet) && this.reservations.length !== 0) {
            const filteredReservations = this.reservations.filter(x => !x.deleted);
            for (let i = 0; i < filteredReservations.length; i++) {
                const proxyCell = filteredReservations[i];
                // TODO: outsource in function
                const rule = this.getRuleFor(proxyCell);
                if (!this.isEmpty(rule)) {
                    proxyCell.rule = rule;
                    if (rule.hasOwnProperty('area') && this.areaMap.hasOwnProperty(rule.area)) {
                        proxyCell.processRules(this.areaMap, this.rowCount);
                    }
                }
            }
        }
    }

    setGlobalStyles() {
        let style = `
        
        adaptive-grid > * {
          -webkit-box-sizing: border-box;
          -moz-box-sizing: border-box;
          box-sizing: border-box;
          overflow-x: scroll;
        }
        
        [data-adaptive-grid-active="true"] {
            display: grid;
            
            grid-template-columns: repeat(${AdaptiveGrid.gridSize}, calc(8.333% - ${this.colGap - 1.25}px));
            
            grid-template-rows: repeat(${this.rowCount}, ${this.cellHeight + (this.cellHeight / this.rowCount)}px);  
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


        for (let i = 1; i <= this.rowCount; i++) {
            style += `[data-g-r-start="${i}"] { grid-row-start: ${i}}`;  // posY
            style += `[data-g-r-end="${i}"] { grid-row-end: span ${i}}`; // rowSpan
        }

        this.globalStyles = style;
    }

    setGridDimensions() {
        this.rootNode.dataset.adaptiveGridRowCount = this.rowCount.toString();
    }

    activateAdaptiveGridStyles() {
        this.rootNode.dataset.adaptiveGridActive = "true";

    }

    clearAdaptiveGrid() {
        this.register = [];
        this.gridLayout = '';
        // this.newNodePipeline = [];
        this.nodePipeline.clear();
        // this.removingNodePipeline = [];
        this.rowCount = 1;
    }

    getRuleFor(proxyCell) {
        const classList = this.ruleSet.positioning.map(function (rule) {
            return rule.affected;
        });

        const nodeClasses = [...proxyCell.nodeRef.classList];

        let index = -1;

        const found = nodeClasses.some(function (v) {
            if (classList.indexOf(v) > -1) {
                index = classList.indexOf(v);
                return true;
            }
            return false;
        });

        if (found && index > -1) {
            const nodeClass = classList[index];
            const ruleIndex = this.ruleSet.positioning.findIndex(rule => rule.affected === nodeClass);
            return this.ruleSet.positioning[ruleIndex];
        }

        return {};
    }
}

// Define the new element
customElements.define('adaptive-grid', AdaptiveGrid);