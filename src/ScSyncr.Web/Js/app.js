﻿/// <reference path="../scripts/typings/knockout/knockout.d.ts" />

ko.bindingHandlers.diff = {
    init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        // This will be called when the binding is first applied to an element
        // Set up any initial state, event handlers, etc. here
        var unwrapped = valueAccessor(), source = unwrapped.source(), target = unwrapped.target();

        $(element).mergely({
            cmsettings: { readOnly: true },
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

var ScSyncr;
(function (ScSyncr) {
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
    ScSyncr.MessageBus = MessageBus;

    var ContextualMenuAction = (function () {
        function ContextualMenuAction(title, action, icon, description) {
            this.title = title;
            this.action = action;
            this.icon = icon;
            this.description = description;
        }
        return ContextualMenuAction;
    })();
    ScSyncr.ContextualMenuAction = ContextualMenuAction;

    var ContextualMenu = (function () {
        function ContextualMenu() {
            this.actions = [];
        }
        return ContextualMenu;
    })();
    ScSyncr.ContextualMenu = ContextualMenu;

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
    ScSyncr.Viewer = Viewer;

    (function (DiffType) {
        DiffType[DiffType["Remove"] = 0] = "Remove";
        DiffType[DiffType["Add"] = 1] = "Add";
        DiffType[DiffType["Unmodified"] = 2] = "Unmodified";
        DiffType[DiffType["Modified"] = 3] = "Modified";
    })(ScSyncr.DiffType || (ScSyncr.DiffType = {}));
    var DiffType = ScSyncr.DiffType;

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
    ScSyncr.DiffDetail = DiffDetail;

    var Node = (function () {
        function Node(source, target) {
            var _this = this;
            this.source = ko.observable(null);
            this.target = ko.observable(null);
            this.children = ko.observableArray([]);
            this.childrenLoaded = ko.observable(false);
            this.expanded = ko.observable(false);
            this.loadingChildren = ko.observable(false);
            this.diffDetails = ko.observable(null);
            this.syncExcluded = ko.observable(false);
            this.source(source ? new Item(source) : null);
            this.target(target ? new Item(target) : null);

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
                return _this.source() ? _this.source().name : _this.target().name;
            });
            this.icon = ko.computed(function () {
                return _this.source() ? _this.source().icon : _this.target().icon;
            });
            this.diffDetails(this.getDiffDetails());
            this.diffClass = ko.computed(function () {
                var diff = _this.diffDetails();
                return _this.syncExcluded() ? diff.className + " diff-icon-disabled" : diff.className;
            });
            this.diffTitle = ko.computed(function () {
                var diff = _this.diffDetails();
                return _this.syncExcluded() ? "Excluded: " + diff.title : diff.title;
            });
        }
        Node.prototype.processChildren = function (srcChildren, tgtChildren) {
            if (!srcChildren && !tgtChildren) {
                this.childrenLoaded(false);
                return;
            }

            srcChildren = srcChildren || [];
            tgtChildren = tgtChildren || [];

            var srcIdx = 0, tgtIdx = 0, tgtLastMatched = 0, srcLen = srcChildren.length, tgtLen = tgtChildren.length;

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
            var mng = ServiceLocator.current.requestManager, srcSvc = ServiceLocator.current.srcSvc, tgtSvc = ServiceLocator.current.tgtSvc, src = this.source(), tgt = this.target();

            if (src && tgt) {
                var srcPromise = mng.add(function () {
                    return srcSvc.getTreeItem(src.id);
                });
                var tgtPromise = mng.add(function () {
                    return tgtSvc.getTreeItem(tgt.id);
                });
                return $.when(srcPromise, tgtPromise).done(function (source, target) {
                    _this.processChildren(source.Children, target.Children);
                }).always(function () {
                    _this.loadingChildren(false);
                    _this.expanded(true);
                });
            } else if (src) {
                return mng.add(function () {
                    return srcSvc.getTreeItem(src.id);
                }).done(function (source) {
                    _this.processChildren(source.Children, null);
                }).always(function () {
                    _this.loadingChildren(false);
                    _this.expanded(true);
                });
                ;
            } else if (tgt) {
                return mng.add(function () {
                    return tgtSvc.getTreeItem(tgt.id);
                }).done(function (target) {
                    _this.processChildren(null, target.Children);
                }).always(function () {
                    _this.loadingChildren(false);
                    _this.expanded(true);
                });
                ;
            }
            return null;
        };

        Node.prototype.ensureChildrenLoaded = function () {
            if (!this.childrenLoaded()) {
                return this.loadChildren();
            }
            var dfd = $.Deferred();
            dfd.resolve(true);
            return dfd.promise();
        };

        Node.prototype.getDiffDetails = function () {
            var src = this.source(), tgt = this.target();
            if (!src) {
                return DiffDetail.remove;
            } else if (!tgt) {
                return DiffDetail.add;
            } else if (src.hash == tgt.hash) {
                return DiffDetail.unmodified;
            }
            return DiffDetail.modified;
        };

        Node.prototype.updateContextMenu = function () {
            var menu = new ContextualMenu();
            menu.actions.push(new ContextualMenuAction("Sync", this.sync.bind(this), "octicon octicon-git-pull-request", "Applies source item changes to target."));
            menu.actions.push(new ContextualMenuAction("Sync Recursive", this.syncWithChildren.bind(this), "octicon octicon-git-pull-request", "Applies source item & children changes to target."));
            MessageBus.current.send("new-contextual-menu", this, menu);
        };

        Node.prototype.showDetails = function () {
            //menu
            this.updateContextMenu();
            this.ensureItemLoaded(true);
        };

        Node.prototype.ensureItemLoaded = function (refreshViewer) {
            var _this = this;
            //fetch items details
            var mng = ServiceLocator.current.requestManager, srcSvc = ServiceLocator.current.srcSvc, tgtSvc = ServiceLocator.current.tgtSvc, src = this.source(), tgt = this.target(), srcPromise, tgtPromise;

            if (src && tgt) {
                srcPromise = mng.add(function () {
                    return srcSvc.getItem(src.id);
                });
                tgtPromise = mng.add(function () {
                    return tgtSvc.getItem(tgt.id);
                });

                return $.when(srcPromise, tgtPromise).done(function (source, target) {
                    _this.sourceDetails = source;
                    _this.targetDetails = target;
                    if (refreshViewer) {
                        ServiceLocator.current.viewer.show(source, target);
                    }
                });
            } else if (src) {
                srcPromise = mng.add(function () {
                    return srcSvc.getItem(src.id);
                });
                return srcPromise.done(function (source) {
                    _this.sourceDetails = source;
                    if (refreshViewer) {
                        ServiceLocator.current.viewer.show(source, null);
                    }
                });
            } else if (tgt) {
                tgtPromise = mng.add(function () {
                    return tgtSvc.getItem(tgt.id);
                });
                return tgtPromise.done(function (target) {
                    _this.targetDetails = target;
                    if (refreshViewer) {
                        ServiceLocator.current.viewer.show(null, target);
                    }
                });
            }

            var dfd = $.Deferred();
            dfd.resolve(true);
            return dfd.promise();
        };

        Node.prototype.sync = function () {
            this.syncHelper(true);
        };

        Node.prototype.syncHelper = function (shouldRefreshViewer) {
            var _this = this;
            var mng = ServiceLocator.current.requestManager, tgtSvc = ServiceLocator.current.tgtSvc, diff = this.diffDetails();

            if (diff.type == 1 /* Add */ || diff.type == 3 /* Modified */) {
                return mng.add(function () {
                    return tgtSvc.updateItem(_this.sourceDetails);
                }).done(function (target) {
                    _this.target(new Item({ Id: target.Item.ID, Name: target.Item.Name, ParentId: target.Item.ParentID, Hash: target.Hash, Children: null, Icon: null }));
                    _this.targetDetails = target;
                    _this.diffDetails(_this.getDiffDetails());
                    _this.updateContextMenu();
                    if (shouldRefreshViewer) {
                        ServiceLocator.current.viewer.show(_this.sourceDetails, target);
                    }
                });
            }

            if (diff.type == 0 /* Remove */) {
                return mng.add(function () {
                    return tgtSvc.deleteItem(_this.target().id);
                }).done(function (_) {
                    _this.target(null);
                    _this.targetDetails = null;
                    _this.diffDetails(_this.getDiffDetails());
                    _this.updateContextMenu();
                    if (shouldRefreshViewer) {
                        ServiceLocator.current.viewer.show(null, null);
                    }
                });
            }

            var dfd = $.Deferred();
            dfd.resolve(true);
            return dfd.promise();
        };

        Node.prototype.syncWithChildren = function () {
            this.syncChildrenHelper(true);
        };

        Node.prototype.syncChildrenHelper = function (shouldRefreshViewer) {
            var _this = this;
            this.ensureItemLoaded().done(function () {
                return _this.syncHelper(shouldRefreshViewer);
            }).done(this.ensureChildrenLoaded.bind(this)).done(function () {
                _this.children().forEach(function (child) {
                    child.syncChildrenHelper(false);
                });
            });
        };
        return Node;
    })();
    ScSyncr.Node = Node;

    var Item = (function () {
        function Item(data) {
            this.id = data.Id;
            this.name = data.Name;
            this.parentId = data.ParentId;
            this.hash = data.Hash;
            this.icon = data.Icon;
        }
        return Item;
    })();
    ScSyncr.Item = Item;

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

        DataService.prototype.updateItem = function (item) {
            return $.ajax({
                contentType: "application/json",
                type: "POST",
                url: this.baseUrl + "update-item?db=" + this.db,
                data: JSON.stringify(item)
            });
        };

        DataService.prototype.deleteItem = function (itemId) {
            return $.ajax({
                contentType: "application/json",
                type: "POST",
                url: this.baseUrl + "delete-item?db=" + this.db,
                data: { itemId: itemId }
            });
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

        DataServiceMocked.prototype.updateItem = function (item) {
            var dfd = $.Deferred();

            setTimeout(function () {
                dfd.resolve(item);
            }, 1000);

            return dfd.promise();
        };

        DataServiceMocked.prototype.deleteItem = function (itemId) {
            var dfd = $.Deferred();

            setTimeout(function () {
                dfd.resolve({});
            }, 1000);

            return dfd.promise();
        };
        return DataServiceMocked;
    })();

    var ServiceLocator = (function () {
        function ServiceLocator() {
            this.viewer = new Viewer();
            this.requestManager = new RequestManager(2);
            this.srcSvc = new DataService();
            this.tgtSvc = new DataService();
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
    ScSyncr.ViewModel = ViewModel;

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
    ScSyncr.Navigation = Navigation;

    function mockItem(currentId) {
        var t = (Math.random() < 0.5 ? "1111" : "0000");
        return { Item: null, Hash: t, Raw: t };
    }

    function mockTreeItem(currentId, mustExist, addChildren) {
        var shouldExist = Math.random() < 0.5, hash = Math.random() < 0.5 ? "1234" : "1253";
        if (!shouldExist && !mustExist) {
            return null;
        }

        var treeDto = { Id: currentId.substring(0, 3) + "1", Name: "Node " + currentId + "1", ParentId: currentId, Hash: hash, Children: null, Icon: null };
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
})(ScSyncr || (ScSyncr = {}));
//# sourceMappingURL=app.js.map
