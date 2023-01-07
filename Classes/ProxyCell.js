import {AdaptiveGrid} from "../index";

export default class ProxyCell {
    gridSize
    posX = undefined;
    posY = undefined;
    size = 0;
    colSpan = 0;
    rowSpan = 0;
    nodeRef = null;

    deleted = false;

    proxyNeighbourNorth = null;
    proxyNeighbourEast = null;
    proxyNeighbourSouth = null;
    proxyNeighbourWest = null;

    constructor(nodeRef) {
        this.nodeRef = nodeRef;
    }

    setAttributes(adaptiveGrid) {
        if (this.colSpan === 0 && this.rowSpan === 0) return;
        if ((this.posX + this.colSpan) > AdaptiveGrid.gridSize) {
            const startPos = (this.posX + 2) - this.colSpan; // weil grid 12 Spalten hat und bei 1 anfängt zählen
            this.nodeRef.dataset.gCStart = startPos.toString();
            this.nodeRef.dataset.gCEnd = this.colSpan.toString();
        } else {
            this.nodeRef.dataset.gCStart = (this.posX + 1).toString();
            this.nodeRef.dataset.gCEnd = this.colSpan.toString();
        }
        if ((this.posY + this.colSpan) > adaptiveGrid.length) {
            const startPos = (this.posY + 1) - this.colSpan;
            this.nodeRef.dataset.gRStart = startPos.toString();
            this.nodeRef.dataset.gREnd = this.rowSpan.toString();
        } else {
            this.nodeRef.dataset.gRStart = (this.posY + 1).toString();
            this.nodeRef.dataset.gREnd = this.rowSpan.toString();
        }

    }
}