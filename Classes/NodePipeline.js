export default class NodePipeline {
    adaptiveGridRef
    newNodes = [];
    removedNodes = [];
    rootNode;
    constructor(adaptiveGridRef) {
        this.adaptiveGridRef = adaptiveGridRef;
    }


    push(el, replace = false, build = false) {
        if (el !== undefined && el.nodeType === 1 && el.nodeName !== "STYLE") {
            this.adaptiveGridRef.rootNode.dataset.adaptiveGridActive = "false";
            const temp = {
                clientHeight: el.clientHeight,
                clientWidth: el.clientWidth,
                dataSet: el.dataSet,
                ref: el,
            };

            if (this.adaptiveGridRef.reservations.length > 0 && replace) {
                const index = this.adaptiveGridRef.reservations.findIndex((proxyCell) => proxyCell.nodeRef.isEqualNode(el));
                if (index > -1) {
                    if (replace) {
                        this.adaptiveGridRef.reservations.splice(index, 1);
                    }
                }
            }

            if (this.adaptiveGridRef.cellStorage.length > 0 && replace) {
                const index = this.adaptiveGridRef.cellStorage.findIndex((proxyCell) => proxyCell.nodeRef.isEqualNode(el));
                if (index > -1) {
                    if (replace) {
                        this.adaptiveGridRef.cellStorage.splice(index, 1);
                    }
                }
            }

            this.newNodes.push(temp);
            if (build) this.adaptiveGridRef.build();
        }
    }
    remove(node) {
        this.removedNodes.push(node);
    }

    filter(nodeName) {
        return this.newNodes.filter((node) => node.nodeName !== nodeName);
    }

    clear() {
        this.newNodes = [];
        this.removedNodes = [];
    }

    newNodeInPipe() {
        return this.newNodes.length + this.removedNodes.length > 0;
    }
}