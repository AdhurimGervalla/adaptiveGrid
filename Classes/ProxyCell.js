import {AdaptiveGrid} from "./index.js";

export default class ProxyCell {
    gridSize
    posX = 0;
    posY = 0;
    size = 0;
    colSpan = 0;
    rowSpan = 0;
    nodeRef = null;

    deleted = false;

    rule = undefined;

    proxyNeighbourNorth = null;
    proxyNeighbourEast = null;
    proxyNeighbourSouth = null;
    proxyNeighbourWest = null;

    constructor(nodeRef) {
        this.nodeRef = nodeRef;
    }

    setAttributes() {
        if (this.colSpan === 0 && this.rowSpan === 0) return;
        this.deleted = true;

        let colStartPos = (this.posX + 1).toString();

        this.nodeRef.dataset.gCStart = colStartPos.toString();
        this.nodeRef.dataset.gCEnd = this.colSpan.toString();

        let rowStartPos = (this.posY + 1).toString();
        this.nodeRef.dataset.gRStart = rowStartPos.toString();
        this.nodeRef.dataset.gREnd = this.rowSpan.toString();

    }

    processRules(areaMap, rowCount) {
        if (this.rule === undefined) return;
        if (this.rule.hasOwnProperty('area') && areaMap.hasOwnProperty(this.rule.area)) {
            const coordinates = areaMap[this.rule.area];
            this.posX = coordinates.x === "len" || coordinates.x >= AdaptiveGrid.gridSize -1 ? AdaptiveGrid.gridSize - 1 - (this.colSpan - 1) : coordinates.x;
            this.posY = coordinates.y === 'len' ? rowCount - 1 - (this.rowSpan -1) :  coordinates.y;
        }
        return this;
    }

    setCoordinates(x, y) {
        this.posX = x;
        this.posY = y;
    }
}