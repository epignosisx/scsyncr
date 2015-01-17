/// <reference path="../scripts/typings/knockout/knockout.d.ts" />
var Tree;
(function (Tree) {
    var ItemComparer = (function () {
        function ItemComparer() {
        }
        ItemComparer.prototype.compare = function (source, target) {
            return source.field == target.field;
        };
        return ItemComparer;
    })();
    Tree.ItemComparer = ItemComparer;

    var Node = (function () {
        function Node(source, target, children) {
            var _this = this;
            this.children = ko.observableArray([]);
            this.childrenLoaded = ko.observable(false);
            this.expanded = ko.observable(false);
            this.loadingChildren = ko.observable(false);
            this.diffClass = ko.observable("");
            this.source = source;
            this.target = target;
            this.children.push.apply(this.children, children);
            this.childrenLoaded(this.children().length > 0);
            this.expandClass = ko.computed(function () {
                if (_this.loadingChildren()) {
                    return "fa-spinner fa-spin";
                }
                return _this.expanded() ? "fa-minus-square-o" : "fa-plus-square-o";
            });
            this.name = ko.computed(function () {
                return _this.source ? _this.source.name : _this.target.name;
            });
            this.diffClass(this.getDiffClass());
        }
        Node.prototype.toggleExpand = function () {
            var _this = this;
            if (this.expanded()) {
                this.expanded(false);
            } else if (this.childrenLoaded()) {
                this.expanded(true);
            } else {
                this.loadingChildren(true);
                setTimeout(function () {
                    _this.children.push(populateNode(0, 1, 1, 3), populateNode(0, 1, 1, 3), populateNode(0, 1, 1, 3));
                    _this.loadingChildren(false);
                    _this.expanded(true);
                }, 2000);
            }
        };

        Node.prototype.getDiffClass = function () {
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
        };

        Node.prototype.showDetails = function () {
        };
        return Node;
    })();
    Tree.Node = Node;

    var Item = (function () {
        function Item(data) {
            this.id = data.id;
            this.name = data.name;
        }
        return Item;
    })();
    Tree.Item = Item;

    var ViewModel = (function () {
        function ViewModel() {
        }
        return ViewModel;
    })();
    Tree.ViewModel = ViewModel;

    function populateNode(level, limit, index, childrenTotal) {
        var sourceItem = Math.random() < 0.5 ? null : new Item({ id: level.toString(), name: "Node " + level + "." + index });
        var targetItem = Math.random() < 0.5 && sourceItem != null ? null : new Item({ id: level.toString(), name: "Node " + level + "." + index });
        if (sourceItem) {
            sourceItem.field = Math.random() < 0.5 ? "1" : "2";
        }
        if (targetItem) {
            targetItem.field = Math.random() < 0.5 ? "1" : "2";
        }
        var children = [];

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
})(Tree || (Tree = {}));
//# sourceMappingURL=app.js.map
