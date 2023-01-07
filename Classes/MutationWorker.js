export default class MutationWorker {

    mutationObserver;

    childTreeChangesObserver;

    observer;
    nodePipeline

    attach(observer) {
        this.observer = observer;
        this.nodePipeline = observer.nodePipeline;
    }

    observeChildElements(rootNode, options) {
        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                const target = mutation.target;
                if (!target.isEqualNode(this.observer.rootNode)) return;
                mutation.addedNodes.forEach((el, index) => {
                    this.nodePipeline.push(el);
                });

                mutation.removedNodes.forEach((el, index) => {
                    if (el !== undefined && el.nodeType === 1) {
                        this.nodePipeline.remove(el);
                    }
                });
                if (this.nodePipeline.newNodeInPipe()) this.observer.build();
            });
        });
        this.mutationObserver.observe(rootNode, options);
    }

    observeChildTreeChanges(rootNode, options) {
        this.childTreeChangesObserver = new MutationObserver((mutations) => {
            const mutation = mutations[0];
            if (mutation["type"] === "attributes") {

                const target = mutation.target;
                let ancestor = this.observer.checkAncestor(target)

                // add that ancestor to the newNodePipline
                if (this.observer.isDirectSuccessor(ancestor)) {
                    // rootNode.dataset.adaptiveGridActive = "false";
                    rootNode.dataset.adaptiveGridActive = "false";
                    this.nodePipeline.push(ancestor, true, true);
                }
            }
        });
        this.childTreeChangesObserver.observe(rootNode, options);
    }

    disconnectFromChildTreeChanges() {
        if (this.childTreeChangesObserver) {
            this.childTreeChangesObserver.disconnect();
        }
    }
}