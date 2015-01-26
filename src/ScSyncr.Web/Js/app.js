/// <reference path="../scripts/typings/knockout/knockout.d.ts" />
var Tree;
(function (Tree) {
    var MessageBus = (function () {
        function MessageBus() {
            this.listenersHash = {};
        }
        MessageBus.prototype.listen = function (messageType, callback) {
            var listeners = this.listenersHash[messageType] || [];
            listeners.push(callback);
            this.listenersHash[messageType] = listeners;
        };

        MessageBus.prototype.send = function (messageType, sender, data) {
            var listeners = this.listenersHash[messageType] || [], i = 0, l = listeners.length;

            for (; i < l; i++) {
                listeners[i](sender, data);
            }
        };
        MessageBus.current = new MessageBus();
        return MessageBus;
    })();
    Tree.MessageBus = MessageBus;

    var ContextualMenuAction = (function () {
        function ContextualMenuAction(title, action, icon, description) {
            this.title = title;
            this.action = action;
            this.icon = icon;
            this.description = description;
        }
        return ContextualMenuAction;
    })();
    Tree.ContextualMenuAction = ContextualMenuAction;

    var ContextualMenu = (function () {
        function ContextualMenu() {
            this.actions = [];
        }
        return ContextualMenu;
    })();
    Tree.ContextualMenu = ContextualMenu;

    var Viewer = (function () {
        function Viewer() {
            this.source = ko.observable(null);
            this.target = ko.observable(null);
        }
        Viewer.prototype.show = function (source, target) {
            this.source(source);
            this.target(target);
        };
        return Viewer;
    })();
    Tree.Viewer = Viewer;

    var ItemComparer = (function () {
        function ItemComparer() {
        }
        ItemComparer.prototype.compare = function (source, target) {
            return source.field == target.field;
        };
        return ItemComparer;
    })();
    Tree.ItemComparer = ItemComparer;

    (function (DiffType) {
        DiffType[DiffType["Remove"] = 0] = "Remove";
        DiffType[DiffType["Add"] = 1] = "Add";
        DiffType[DiffType["Unmodified"] = 2] = "Unmodified";
        DiffType[DiffType["Modified"] = 3] = "Modified";
    })(Tree.DiffType || (Tree.DiffType = {}));
    var DiffType = Tree.DiffType;

    var DiffDetail = (function () {
        function DiffDetail(type, className, title) {
            this.type = type;
            this.className = className;
            this.title = title;
        }
        DiffDetail.remove = new DiffDetail(0 /* Remove */, "fa-minus-circle", "Does not exists in source, will be removed in target.");
        DiffDetail.add = new DiffDetail(1 /* Add */, "fa-plus-circle", "Does not exists in target, will be added in target.");
        DiffDetail.unmodified = new DiffDetail(2 /* Unmodified */, "fa-check-circle", "Same in source and target. No action will be taken.");
        DiffDetail.modified = new DiffDetail(3 /* Modified */, "fa-exclamation-circle", "Different between source and target. Target will be overriden.");
        return DiffDetail;
    })();
    Tree.DiffDetail = DiffDetail;

    var Node = (function () {
        function Node(source, target, children) {
            var _this = this;
            this.children = ko.observableArray([]);
            this.childrenLoaded = ko.observable(false);
            this.expanded = ko.observable(false);
            this.loadingChildren = ko.observable(false);
            this.syncExcluded = ko.observable(false);
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
            this.diffDetails = this.getDiffDetails();
            this.diffClass = ko.computed(function () {
                return _this.syncExcluded() ? _this.diffDetails.className + " diff-icon-disabled" : _this.diffDetails.className;
            });
            this.diffTitle = ko.computed(function () {
                return _this.syncExcluded() ? "Excluded: " + _this.diffDetails.title : _this.diffDetails.title;
            });
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

        Node.prototype.loadChildren = function () {
            var mgr = ServiceLocator.current.requestManager;

            var srcPromise = mgr.add(function () {
                return $.getJSON("", {});
            });
            var tgtPromise = mgr.add(function () {
                return $.getJSON("", {});
            });

            $.when([srcPromise, tgtPromise]).done(this.loadChildrenSuccess.bind(this));
        };

        Node.prototype.loadChildrenSuccess = function (data) {
        };

        Node.prototype.getDiffDetails = function () {
            if (!this.source) {
                return DiffDetail.remove;
            } else if (!this.target) {
                return DiffDetail.add;
            } else {
                var comparer = new ItemComparer();
                if (comparer.compare(this.source, this.target)) {
                    return DiffDetail.unmodified;
                }
                return DiffDetail.modified;
            }
        };

        Node.prototype.showDetails = function () {
            var menu = new ContextualMenu();

            if (this.diffDetails.type == 3 /* Modified */) {
                menu.actions.push(new ContextualMenuAction("Merge", this.merge.bind(this), "octicon octicon-git-merge", "Merge conflicts between source and target."));
            } else if (this.diffDetails.type == 1 /* Add */) {
                menu.actions.push(new ContextualMenuAction("Exclude", this.exclude.bind(this), "fa fa-ban", "Prevents source item from being added to target."));
                //menu.actions.push(new ContextualMenuAction("Undo Exclude", this.ignore.bind(this), "fa fa-undo", "Prevents source item from being added to target."));
            } else if (this.diffDetails.type == 0 /* Remove */) {
                menu.actions.push(new ContextualMenuAction("Keep Target", this.keepTarget.bind(this), "octicon octicon-bookmark", "Prevents target item from being removed."));
                menu.actions.push(new ContextualMenuAction("Keep Target & Children", this.removeTarget.bind(this), "octicon octicon-bookmark", "Prevents target item and its children from being removed"));
                //menu.actions.push(new ContextualMenuAction("Undo Keep Target", this.removeTarget.bind(this), "fa fa-undo", "Undo: Prevents target item from being removed."));
                //menu.actions.push(new ContextualMenuAction("Undo Keep Target & Children", this.removeTarget.bind(this), "fa fa-undo", "Undo: Prevents target item and its children from being removed"));
            } else if (this.diffDetails.type == 2 /* Unmodified */) {
            }

            if (this.diffDetails.type == 1 /* Add */ || this.diffDetails.type == 0 /* Remove */) {
                menu.actions.push(new ContextualMenuAction("Sync", this.sync.bind(this), "octicon octicon-git-pull-request", "Commit changes to item to target."));
                menu.actions.push(new ContextualMenuAction("Sync With Children", this.syncWithChildren.bind(this), "octicon octicon-git-pull-request", "Commit changes to item and children to target."));
            }

            MessageBus.current.send("new-contextual-menu", this, menu);
        };

        Node.prototype.exclude = function () {
            this.syncExcluded(true);
        };

        Node.prototype.merge = function () {
        };

        Node.prototype.removeTarget = function () {
        };

        Node.prototype.keepTarget = function () {
        };

        Node.prototype.sync = function () {
        };

        Node.prototype.syncWithChildren = function () {
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

    var RequestManager = (function () {
        function RequestManager(maxConcurrentRequests) {
            this.queue = [];
            this.maxConcurrentRequests = maxConcurrentRequests;
        }
        RequestManager.prototype.add = function (request) {
            var dfd = $.Deferred();
            this.queue.unshift({ op: request, promise: dfd });
            this.fireNext();
            return dfd.promise();
        };

        RequestManager.prototype.fireNext = function () {
            var _this = this;
            if (this.ongoingCount >= this.maxConcurrentRequests) {
                return;
            }

            var request = this.queue.pop();
            if (request) {
                this.ongoingCount++;
                request.op().then(function (value) {
                    _this.ongoingCount--;
                    _this.fireNext();
                    request.promise.resolve(value);
                }, function () {
                    var args = [];
                    for (var _i = 0; _i < (arguments.length - 0); _i++) {
                        args[_i] = arguments[_i + 0];
                    }
                    _this.ongoingCount--;
                    _this.fireNext();
                    request.promise.reject(args);
                });
            }
        };
        return RequestManager;
    })();

    var DataService = (function () {
        function DataService() {
        }
        DataService.prototype.setBaseUrl = function (baseUrl) {
            baseUrl = baseUrl.replace("http://", "").replace("/sitecore", "");
            if (baseUrl.charAt[baseUrl.length - 1] === "/") {
                baseUrl = baseUrl.substring(baseUrl.length - 1, 1);
            }
            this.baseUrl = "http://" + baseUrl + "/scsyncr/";
        };

        DataService.prototype.getTreeItem = function (itemId) {
            return $.getJSON(this.baseUrl + "get-tree-item", { itemId: itemId, db: this.db });
        };

        DataService.prototype.getItem = function (itemId) {
            return $.getJSON(this.baseUrl + "get-item", { itemId: itemId, db: this.db });
        };
        return DataService;
    })();

    var ServiceLocator = (function () {
        function ServiceLocator() {
            this.requestManager = new RequestManager(2);
            this.srcSrv = new DataService();
            this.tgtSrv = new DataService();
        }
        ServiceLocator.current = new ServiceLocator();
        return ServiceLocator;
    })();

    var ViewModel = (function () {
        function ViewModel() {
            this.viewer = new Viewer();
            this.navigation = new Navigation();
            this.sourceEndpoint = ko.observable();
            this.targetEndpoint = ko.observable();
        }
        return ViewModel;
    })();
    Tree.ViewModel = ViewModel;

    var Navigation = (function () {
        function Navigation() {
            this.contextualMenu = ko.observable(new ContextualMenu());
            MessageBus.current.listen("new-contextual-menu", this.newMenu.bind(this));
        }
        Navigation.prototype.newMenu = function (sender, data) {
            var menu = data;
            this.contextualMenu(menu);
        };
        return Navigation;
    })();
    Tree.Navigation = Navigation;

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

    var serviceLocator = new ServiceLocator();

    function parseQuerystring() {
        var qs = window.location.search;
        var obj = {};
        if (qs.length) {
            qs = qs.substring(1);
            var vars = qs.split('&');
            for (var i = 0; i < vars.length; i++) {
                var pair = vars[i].split('=');
                obj[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
            }
        }
        return obj;
    }

    (function () {
        var qs = parseQuerystring();
        var sl = ServiceLocator.current;

        sl.srcSrv.setBaseUrl(qs.src);
        sl.srcSrv.db = qs.db;
        sl.tgtSrv.setBaseUrl(qs.tgt);
        sl.tgtSrv.db = qs.db;

        var vm = new ViewModel();
        vm.sourceEndpoint(qs.src);
        vm.targetEndpoint(qs.tgt);
        vm.root = populateNode(0, 2, 1, 3);

        ko.applyBindings(vm);

        var mgr = sl.requestManager;
        var srcPromise = mgr.add(function () {
            return sl.srcSrv.getTreeItem("{11111111-1111-1111-1111-111111111111}");
        });
        var tgtPromise = mgr.add(function () {
            return sl.tgtSrv.getTreeItem("{11111111-1111-1111-1111-111111111111}");
        });

        $.when(srcPromise, tgtPromise).done(function (srcItem, tgtItem) {
            console.log(srcItem, "source");
            console.log(tgtItem, "target");
        });
    })();
})(Tree || (Tree = {}));
//# sourceMappingURL=app.js.map
