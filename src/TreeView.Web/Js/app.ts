/// <reference path="../scripts/typings/knockout/knockout.d.ts" />

module Tree {

    export class ItemComparer {
        compare(source: Item, target: Item) {
            return source.field == target.field;
        }
    }

    export class Node {
        source: Item;
        target: Item;
        children: KnockoutObservableArray<Node> = ko.observableArray([]);
        childrenLoaded: KnockoutObservable<boolean> = ko.observable(false);
        expanded: KnockoutObservable<boolean> = ko.observable(false);
        loadingChildren: KnockoutObservable<boolean> = ko.observable(false);
        expandClass: KnockoutComputed<string>;
        diffClass: KnockoutObservable<string> = ko.observable("");
        name: KnockoutComputed<string>;

        constructor(source: Item, target: Item, children: Node[]) {
            this.source = source;
            this.target = target;
            this.children.push.apply(this.children, children);
            this.childrenLoaded(this.children().length > 0);
            this.expandClass = ko.computed(() => {
                if (this.loadingChildren()) {
                    return "fa-spinner fa-spin";
                }
                return this.expanded() ? "fa-minus-square-o" : "fa-plus-square-o";
            });
            this.name = ko.computed(() => {
                return this.source ? this.source.name : this.target.name;
            });
            this.diffClass(this.getDiffClass());
        }

        toggleExpand() {
            if (this.expanded()) {
                this.expanded(false);
            } else if (this.childrenLoaded()) {
                this.expanded(true);
            } else {
                this.loadingChildren(true);
                setTimeout(() => {
                    this.children.push(
                        populateNode(0, 1, 1, 3),
                        populateNode(0, 1, 1, 3),
                        populateNode(0, 1, 1, 3)
                    );
                    this.loadingChildren(false);
                    this.expanded(true);
                }, 2000);
            }
        }

        getDiffClass() {
            if (!this.source) {
                return "fa-minus-circle";
            } else if (!this.target) {
                return "fa-plus-circle";
            } else {
                var comparer = new ItemComparer();
                if (comparer.compare(this.source, this.target)) {
                    return "fa-check-circle";
                }
                return "fa-exclamation-circle";
            }
        }

        showDetails() {

        }
    }

    export class Item {
        id: string;
        name: string;

        field: string;

        constructor(data: { id: string; name: string }) {
            this.id = data.id;
            this.name = data.name;
        }
    }

    export class ViewModel {

        root: Node;

    }

    function populateNode(level: number, limit: number, index: number, childrenTotal: number): Node {
        var sourceItem = Math.random() < 0.5 ? null : new Item({ id: level.toString(), name: "Node " + level + "." + index });
        var targetItem = Math.random() < 0.5 && sourceItem != null ? null : new Item({ id: level.toString(), name: "Node " + level + "." + index });
        if (sourceItem) {
            sourceItem.field = Math.random() < 0.5 ? "1" : "2";
        }
        if (targetItem) {
            targetItem.field = Math.random() < 0.5 ? "1" : "2";
        }
        var children: Node[] = [];

        if (level < limit) {
            for (var i = 0; i < childrenTotal; i++) {
                children.push(populateNode(level + 1, limit, i + 1, childrenTotal));
            }
        }

        var node = new Node(sourceItem, targetItem, children);
        return node;
    }

    (function () {
        var vm = new ViewModel();

        vm.root = populateNode(0, 2, 1, 3);

        ko.applyBindings(vm);
    })();


}