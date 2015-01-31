/// <reference path="../scripts/typings/knockout/knockout.d.ts" />

ko.bindingHandlers.diff = {
    init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        // This will be called when the binding is first applied to an element
        // Set up any initial state, event handlers, etc. here
        var unwrapped = valueAccessor(), source = unwrapped.source(), target = unwrapped.target();

        $(element).mergely({
            cmsettings: { readOnly: false },
            lhs: function (setValue) {
                setValue(source ? source.Raw : "");
            },
            rhs: function (setValue) {
                setValue(target ? target.Raw : "");
            }
        });

        unwrapped.source.subscribe(function (newValue) {
            $(element).mergely('lhs', newValue ? newValue.Raw : "");
        });
        unwrapped.target.subscribe(function (newValue) {
            $(element).mergely('rhs', newValue ? newValue.Raw : "");
        });
    }
};

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
            //$("#compare").mergely({
            //    cmsettings: { readOnly: false },
            //    lhs: (setValue) => {
            //        setValue(source ? source.Raw : "");
            //    },
            //    rhs: (setValue) => {
            //        setValue(target ? target.Raw : "");
            //    }
            //});
        };
        return Viewer;
    })();
    Tree.Viewer = Viewer;

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
        function Node(source, target) {
            var _this = this;
            this.children = ko.observableArray([]);
            this.childrenLoaded = ko.observable(false);
            this.expanded = ko.observable(false);
            this.loadingChildren = ko.observable(false);
            this.syncExcluded = ko.observable(false);
            this.source = source ? new Item(source) : null;
            this.target = target ? new Item(target) : null;

            this.processChildren(source ? source.Children : null, target ? target.Children : null);

            this.childrenLoaded(this.children().length > 0);
            this.expandClass = ko.computed(function () {
                if (_this.loadingChildren()) {
                    return "fa-spinner fa-spin";
                } else if (_this.childrenLoaded() && _this.children().length == 0) {
                    return "fa-square-o";
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
        Node.prototype.processChildren = function (srcChildren, tgtChildren) {
            if (!srcChildren && !tgtChildren) {
                this.childrenLoaded(false);
                return;
            }

            srcChildren = srcChildren || [];
            tgtChildren = tgtChildren || [];

            var srcIdx = 0, srcLastMatched = 0, tgtIdx = 0, tgtLastMatched = 0, srcLen = srcChildren.length, tgtLen = tgtChildren.length, src, tgt;

            for (; srcIdx < srcLen; srcIdx++) {
                var found = false;
                for (tgtIdx = tgtLastMatched; tgtIdx < tgtLen; tgtIdx++) {
                    if (srcChildren[srcIdx].Id === tgtChildren[tgtIdx].Id) {
                        while (tgtLastMatched < tgtIdx) {
                            this.children.push(new Node(null, tgtChildren[tgtLastMatched++]));
                        }
                        this.children.push(new Node(srcChildren[srcIdx], tgtChildren[tgtIdx]));
                        tgtLastMatched = tgtIdx + 1;
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    this.children.push(new Node(srcChildren[srcIdx], null));
                }
            }

            this.childrenLoaded(true);
        };

        Node.prototype.toggleExpand = function () {
            if (this.expanded()) {
                this.expanded(false);
            } else if (this.childrenLoaded()) {
                this.expanded(true);
            } else {
                this.loadChildren();
            }
        };

        Node.prototype.loadChildren = function () {
            var _this = this;
            this.loadingChildren(true);
            var mng = ServiceLocator.current.requestManager;
            var srcSvc = ServiceLocator.current.srcSvc;
            var tgtSvc = ServiceLocator.current.tgtSvc;

            if (this.source && this.target) {
                var srcPromise = mng.add(function () {
                    return srcSvc.getTreeItem(_this.source.id);
                });
                var tgtPromise = mng.add(function () {
                    return tgtSvc.getTreeItem(_this.target.id);
                });
                $.when(srcPromise, tgtPromise).done(function (source, target) {
                    _this.processChildren(source.Children, target.Children);
                }).always(function () {
                    _this.loadingChildren(false);
                    _this.expanded(true);
                });
            } else if (this.source) {
                mng.add(function () {
                    return srcSvc.getTreeItem(_this.source.id);
                }).done(function (source) {
                    _this.processChildren(source.Children, null);
                }).always(function () {
                    _this.loadingChildren(false);
                    _this.expanded(true);
                });
                ;
            } else if (this.target) {
                mng.add(function () {
                    return tgtSvc.getTreeItem(_this.target.id);
                }).done(function (target) {
                    _this.processChildren(null, target.Children);
                }).always(function () {
                    _this.loadingChildren(false);
                    _this.expanded(true);
                });
                ;
            }
        };

        Node.prototype.getDiffDetails = function () {
            if (!this.source) {
                return DiffDetail.remove;
            } else if (!this.target) {
                return DiffDetail.add;
            } else if (this.source.hash == this.target.hash) {
                return DiffDetail.unmodified;
            }
            return DiffDetail.modified;
        };

        Node.prototype.showDetails = function () {
            var _this = this;
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

            var mng = ServiceLocator.current.requestManager, srcSvc = ServiceLocator.current.srcSvc, tgtSvc = ServiceLocator.current.tgtSvc, srcPromise, tgtPromise;

            if (this.source && this.target) {
                srcPromise = mng.add(function () {
                    return srcSvc.getItem(_this.source.id);
                });
                tgtPromise = mng.add(function () {
                    return tgtSvc.getItem(_this.target.id);
                });

                $.when(srcPromise, tgtPromise).done(function (source, target) {
                    ServiceLocator.current.viewer.show(source, target);
                });
            } else if (this.source) {
                srcPromise = mng.add(function () {
                    return srcSvc.getItem(_this.source.id);
                });
                srcPromise.done(function (source) {
                    ServiceLocator.current.viewer.show(source, null);
                });
            } else if (this.target) {
                tgtPromise = mng.add(function () {
                    return tgtSvc.getItem(_this.target.id);
                });
                tgtPromise.done(function (target) {
                    ServiceLocator.current.viewer.show(null, target);
                });
            }
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
            this.id = data.Id;
            this.name = data.Name;
            this.parentId = data.ParentId;
            this.hash = data.Hash;
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

    var DataServiceMocked = (function () {
        function DataServiceMocked() {
        }
        DataServiceMocked.prototype.setBaseUrl = function (baseUrl) {
        };

        DataServiceMocked.prototype.getTreeItem = function (itemId) {
            var dfd = $.Deferred();

            setTimeout(function () {
                dfd.resolve(mockTreeItem(itemId, true, true));
            }, 1000);

            return dfd.promise();
        };

        DataServiceMocked.prototype.getItem = function (itemId) {
            var dfd = $.Deferred();

            setTimeout(function () {
                dfd.resolve(mockItem(itemId));
            }, 1000);

            return dfd.promise();
        };
        return DataServiceMocked;
    })();

    var ServiceLocator = (function () {
        function ServiceLocator() {
            this.viewer = new Viewer();
            this.requestManager = new RequestManager(2);
            //srcSvc: IDataService = new DataService();
            //tgtSvc: IDataService = new DataService();
            this.srcSvc = new DataServiceMocked();
            this.tgtSvc = new DataServiceMocked();
        }
        ServiceLocator.current = new ServiceLocator();
        return ServiceLocator;
    })();

    var ViewModel = (function () {
        function ViewModel() {
            this.root = ko.observable();
            this.viewer = ServiceLocator.current.viewer;
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

    function mockItem(currentId) {
        var t = (Math.random() < 0.5 ? "1111" : "0000");
        return { Item: null, Hash: t, Raw: t };
    }

    function mockTreeItem(currentId, mustExist, addChildren) {
        var shouldExist = Math.random() < 0.5;
        if (!shouldExist && !mustExist) {
            return null;
        }

        var treeDto = { Id: currentId.substring(0, 3) + "1", Name: "Node " + currentId + "1", ParentId: currentId, Hash: null, Children: null };
        if (addChildren) {
            treeDto.Children = [];
            for (var i = 0; i < 3; i++) {
                var child = mockTreeItem(treeDto.Id, true, false);
                treeDto.Children.push(child);
            }
        }
        return treeDto;
    }

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

        sl.srcSvc.setBaseUrl(qs.src);
        sl.srcSvc.db = qs.db;
        sl.tgtSvc.setBaseUrl(qs.tgt);
        sl.tgtSvc.db = qs.db;

        var vm = new ViewModel();
        vm.sourceEndpoint(qs.src);
        vm.targetEndpoint(qs.tgt);

        ko.applyBindings(vm);

        var mgr = sl.requestManager;
        var srcPromise = mgr.add(function () {
            return sl.srcSvc.getTreeItem("{11111111-1111-1111-1111-111111111111}");
        });
        var tgtPromise = mgr.add(function () {
            return sl.tgtSvc.getTreeItem("{11111111-1111-1111-1111-111111111111}");
        });

        $.when(srcPromise, tgtPromise).done(function (srcItem, tgtItem) {
            vm.root(new Node(srcItem, tgtItem));
        });
    })();
})(Tree || (Tree = {}));
//# sourceMappingURL=app.js.map
