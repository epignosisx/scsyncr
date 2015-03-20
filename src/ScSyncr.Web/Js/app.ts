/// <reference path="../scripts/typings/knockout/knockout.d.ts" />
interface JQuery {
    mergely(opts: any): JQuery;
    mergely(method: string, param: any): JQuery;
}

interface KnockoutBindingHandlers {
    diff;
    compareResults;
}

ko.bindingHandlers.diff = {
    init: (element: HTMLElement, valueAccessor, allBindings, viewModel, bindingContext) => {
        // This will be called when the binding is first applied to an element
        // Set up any initial state, event handlers, etc. here

        var unwrapped = valueAccessor(),
            source = unwrapped.source(),
            target = unwrapped.target();

        $(element).mergely({
            cmsettings: { readOnly: true },
            lhs: (setValue) => {
                setValue(source ? source.Raw : "");
            },
            rhs: (setValue) => {
                setValue(target ? target.Raw : "");
            }
        });

        unwrapped.source.subscribe(newValue => {
            $(element).mergely('lhs', newValue ? newValue.Raw : "");
        });
        unwrapped.target.subscribe(newValue => {
            $(element).mergely('rhs', newValue ? newValue.Raw : "");
        });

    }
};

ko.bindingHandlers.compareResults = {
    init: (element: HTMLElement, valueAccessor, allBindings, viewModel, bindingContext) => {
        // This will be called when the binding is first applied to an element
        // Set up any initial state, event handlers, etc. here

        var unwrapped = valueAccessor();

    }
};

module ScSyncr {

    export class MessageBus {

        static current: MessageBus = new MessageBus();

        private listenersHash: { [messageType: string]: Array<(sender: any, data: any) => void> } = {};

        listen(messageType: string, callback: (sender: any, data: any) => void) {
            var listeners = this.listenersHash[messageType] || [];
            listeners.push(callback);
            this.listenersHash[messageType] = listeners;
        }

        send(messageType: string, sender: any, data: any) {
            var listeners = this.listenersHash[messageType] || [],
                i = 0, l = listeners.length;

            for (; i < l; i++) {
                listeners[i](sender, data);
            }
        }
    }

    export class ContextualMenuAction {
        title: string;
        icon: string;
        action: () => void;
        description: string;

        constructor(title: string, action: () => void, icon: string, description: string) {
            this.title = title;
            this.action = action;
            this.icon = icon;
            this.description = description;
        }
    }

    export class ContextualMenu {
        actions: ContextualMenuAction[] = [];
    }

    export class Viewer {
        private source: KnockoutObservable<IItemWrapperDto> = ko.observable(null);
        private target: KnockoutObservable<IItemWrapperDto> = ko.observable(null);

        show(source: IItemWrapperDto, target: IItemWrapperDto) {
            this.source(source);
            this.target(target);
        }
    }

    //export class CompareReport {
    //    private results: KnockoutObservableArray<CompareResult> = ko.observableArray([]);

    //    show(results: )
    //}

    export enum DiffType {
        Remove,
        Add,
        Unmodified,
        Modified
    }

    export class DiffDetail {
        type: DiffType;
        className: string;
        title: string;

        constructor(type: DiffType, className: string, title: string) {
            this.type = type;
            this.className = className;
            this.title = title;
        }

        static remove: DiffDetail = new DiffDetail(DiffType.Remove, "fa-minus-circle", "Does not exists in source, will be removed in target.");
        static add: DiffDetail = new DiffDetail(DiffType.Add, "fa-plus-circle", "Does not exists in target, will be added in target.");
        static unmodified: DiffDetail = new DiffDetail(DiffType.Unmodified, "fa-check-circle", "Same in source and target. No action will be taken.");
        static modified: DiffDetail = new DiffDetail(DiffType.Modified, "fa-exclamation-circle", "Different between source and target. Target will be overriden.");
    }

    export class Node {
        parent: Node;
        source: KnockoutObservable<Item> = ko.observable(null);
        target: KnockoutObservable<Item> = ko.observable(null);
        sourceDetails: IItemWrapperDto;
        targetDetails: IItemWrapperDto;
        icon: KnockoutComputed<string>;
        children: KnockoutObservableArray<Node> = ko.observableArray([]);
        childrenLoaded: KnockoutObservable<boolean> = ko.observable(false);
        expanded: KnockoutObservable<boolean> = ko.observable(false);
        loadingChildren: KnockoutObservable<boolean> = ko.observable(false);
        expandClass: KnockoutComputed<string>;
        diffClass: KnockoutComputed<string>;
        diffTitle: KnockoutComputed<string>;
        diffDetails: KnockoutObservable<DiffDetail> = ko.observable(null);
        syncExcluded: KnockoutObservable<boolean> = ko.observable(false);
        name: KnockoutComputed<string>;

        constructor(source: ITreeItemDto, target: ITreeItemDto, parent: Node) {
            this.source(source ? new Item(source) : null);
            this.target(target ? new Item(target) : null);
            this.parent = parent;

            this.processChildren(source ? source.Children : null, target ? target.Children : null);

            this.childrenLoaded(this.children().length > 0);
            this.expandClass = ko.computed(() => {
                if (this.loadingChildren()) {
                    return "fa-spinner fa-spin";
                } else if (this.childrenLoaded() && this.children().length == 0) {
                    return "fa-square-o";
                }
                return this.expanded() ? "fa-minus-square-o" : "fa-plus-square-o";
            });
            this.name = ko.computed(() => {
                return this.source() ? this.source().name : this.target().name;
            });
            this.icon = ko.computed(() => {
                return this.source() ? this.source().icon : this.target().icon;
            });
            this.diffDetails(this.getDiffDetails());
            this.diffClass = ko.computed(() => {
                var diff = this.diffDetails();
                return this.syncExcluded() ? diff.className + " diff-icon-disabled" : diff.className;
            });
            this.diffTitle = ko.computed(() => {
                var diff = this.diffDetails();
                return this.syncExcluded() ? "Excluded: " + diff.title : diff.title; 
            });
        }

        removeChild(child: Node) {
            this.children.remove(child);
        }

        processChildren(srcChildren: ITreeItemDto[], tgtChildren: ITreeItemDto[]) {
            if (!srcChildren && !tgtChildren) {
                this.childrenLoaded(false);
                return;
            }

            srcChildren = srcChildren || [];
            tgtChildren = tgtChildren || [];

            var srcIdx = 0,
                tgtIdx = 0,
                tgtLastMatched = 0,
                srcLen = srcChildren.length,
                tgtLen = tgtChildren.length;

            
            for (; srcIdx < srcLen; srcIdx++) {
                var found = false;
                for (tgtIdx = tgtLastMatched; tgtIdx < tgtLen; tgtIdx++) {
                    if (srcChildren[srcIdx].Id === tgtChildren[tgtIdx].Id) {
                        while (tgtLastMatched < tgtIdx) {
                            this.children.push(new Node(null, tgtChildren[tgtLastMatched++], this));
                        }
                        this.children.push(new Node(srcChildren[srcIdx], tgtChildren[tgtIdx], this));
                        tgtLastMatched = tgtIdx + 1;
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    this.children.push(new Node(srcChildren[srcIdx], null, this));    
                }
            }

            for (; tgtLastMatched < tgtLen; tgtLastMatched++) {
                this.children.push(new Node(null, tgtChildren[tgtLastMatched], this));
            }

            this.childrenLoaded(true);
        }

        toggleExpand() {
            if (this.expanded()) {
                this.expanded(false);
            } else if (this.childrenLoaded()) {
                this.expanded(true);
            } else {
                this.loadChildren();
            }
        }

        loadChildren(): JQueryPromise<any> {
            this.loadingChildren(true);
            var mng = ServiceLocator.current.requestManager,
                srcSvc = ServiceLocator.current.srcSvc,
                tgtSvc = ServiceLocator.current.tgtSvc,
                src = this.source(),
                tgt = this.target();

            if (src && tgt) {
                var srcPromise = mng.add(() => srcSvc.getTreeItem(src.id));
                var tgtPromise = mng.add(() => tgtSvc.getTreeItem(tgt.id));
                return $.when(srcPromise, tgtPromise).done((source: ITreeItemDto, target: ITreeItemDto) => {
                    this.processChildren(source.Children, target.Children);
                }).always(() => {
                    this.loadingChildren(false);
                    this.expanded(true);    
                });
            } else if (src) {
                return mng.add(() => srcSvc.getTreeItem(src.id)).done((source) => {
                    this.processChildren(source.Children, null);
                }).always(() => {
                    this.loadingChildren(false);
                    this.expanded(true);
                });;
            } else if (tgt) {
                return mng.add(() => tgtSvc.getTreeItem(tgt.id)).done((target) => {
                    this.processChildren(null, target.Children);
                }).always(() => {
                    this.loadingChildren(false);
                    this.expanded(true);
                });;
            }
            return null;
        }

        ensureChildrenLoaded(): JQueryPromise<any> {
            if (!this.childrenLoaded()) {
                return this.loadChildren();
            }
            var dfd = $.Deferred();
            dfd.resolve(true);
            return dfd.promise();
        }

        getDiffDetails(): DiffDetail {
            var src = this.source(),
                tgt = this.target();
            if (!src) {
                return DiffDetail.remove;
            } else if (!tgt) {
                return DiffDetail.add;
            } else if(src.hash == tgt.hash) {
                return DiffDetail.unmodified;
            }
            return DiffDetail.modified;
        }

        updateContextMenu() {
            var menu = new ContextualMenu();
            menu.actions.push(new ContextualMenuAction("Sync", this.sync.bind(this), "octicon octicon-git-pull-request", "Applies source item changes to target."));
            menu.actions.push(new ContextualMenuAction("Sync Recursive", this.syncWithChildren.bind(this), "octicon octicon-git-pull-request", "Applies source item & children changes to target."));
            menu.actions.push(new ContextualMenuAction("Compare Recursive", this.compare.bind(this), "fa fa-exchange", "Compares source item & children to target."));
            MessageBus.current.send("new-contextual-menu", this, menu);
        }

        showDetails() {
            //menu
            this.updateContextMenu();
            this.ensureItemLoaded(true);
        }

        ensureItemLoaded(refreshViewer: boolean): JQueryPromise<any> {
            //fetch items details
            var mng = ServiceLocator.current.requestManager,
                srcSvc = ServiceLocator.current.srcSvc,
                tgtSvc = ServiceLocator.current.tgtSvc,
                src = this.source(),
                tgt = this.target(),
                srcPromise,
                tgtPromise;

            if (src && tgt) {
                srcPromise = mng.add(() => srcSvc.getItem(src.id));
                tgtPromise = mng.add(() => tgtSvc.getItem(tgt.id));

                return $.when(srcPromise, tgtPromise).done((source: IItemWrapperDto, target: IItemWrapperDto) => {
                    this.sourceDetails = source;
                    this.targetDetails = target;
                    if (refreshViewer) {
                        ServiceLocator.current.viewer.show(source, target);
                    }
                });
            } else if (src) {
                srcPromise = mng.add(() => srcSvc.getItem(src.id));
                return srcPromise.done((source: IItemWrapperDto) => {
                    this.sourceDetails = source;
                    if (refreshViewer) {
                        ServiceLocator.current.viewer.show(source, null);
                    }
                });
            } else if (tgt) {
                tgtPromise = mng.add(() => tgtSvc.getItem(tgt.id));
                return tgtPromise.done((target: IItemWrapperDto) => {
                    this.targetDetails = target;
                    if (refreshViewer) {
                        ServiceLocator.current.viewer.show(null, target);
                    }
                });
            }

            var dfd = $.Deferred();
            dfd.resolve(true);
            return dfd.promise();
        }

        sync() {
            this.syncHelper(true);
        }

        syncHelper(shouldRefreshViewer: boolean) {
            var mng = ServiceLocator.current.requestManager,
                tgtSvc = ServiceLocator.current.tgtSvc,
                diff = this.diffDetails();

            if (diff.type == DiffType.Add || diff.type == DiffType.Modified) {
                return mng.add(() => tgtSvc.updateItem(this.sourceDetails)).done((target: IItemWrapperDto) => {
                    this.target(new Item({ Id: target.Item.ID, Name: target.Item.Name, ParentId: target.Item.ParentID, Hash: target.Hash, Children: null, Icon: null }));
                    this.targetDetails = target;
                    this.diffDetails(this.getDiffDetails());
                    this.updateContextMenu();
                    if (shouldRefreshViewer) {
                        ServiceLocator.current.viewer.show(this.sourceDetails, target);
                    }
                });
            }

            if (diff.type == DiffType.Remove) {
                return mng.add(() => tgtSvc.deleteItem(this.target().id)).done((_) => {
                    if (this.parent) {
                        this.parent.removeChild(this);
                        this.parent.updateContextMenu();
                        ServiceLocator.current.viewer.show(null, null);
                    }
                });
            }

            var dfd = $.Deferred();
            dfd.resolve(true);
            return dfd.promise();
        }

        syncWithChildren() {
            this.syncChildrenHelper(true);
        }

        syncChildrenHelper(shouldRefreshViewer: boolean) {
            var self = this;
            this.ensureItemLoaded(shouldRefreshViewer)
                .then(() => self.syncHelper(shouldRefreshViewer))
                .then(() => self.ensureChildrenLoaded())
                .then(() => {
                    self.children().forEach((child: Node) => {
                        child.syncChildrenHelper(false);
                    });
                });
        }

        compare() {
            var results = [];
            this.compareHelper(results).then(() => {
                console.log(results);
            });
        }

        compareHelper(results: CompareResult[]): JQueryPromise<any> {
            var diff = this.diffDetails();

            if (diff.type != DiffType.Unmodified) {
                var itemPath = this.getItemPath();
                var result = new CompareResult(itemPath, diff);
                results.push(result);
            }

            var self = this;
            return this.ensureChildrenLoaded().then(() => {
                var promises = [];
                var children = self.children();
                if (children && children.length) {
                    self.children().forEach((child: Node) => {
                        var tempResults = [];
                        var promise = child.compareHelper(tempResults).then(() => {
                            if (tempResults.length) {
                                Array.prototype.push.apply(results, tempResults);
                            } else {
                                //no diffs in children, collapse tree node
                                console.log("expanded(false)");
                                child.expanded(false);
                            }
                        });
                        promises.push(promise);
                    });

                    return $.when.apply($, promises);
                }

                var dfd = $.Deferred();
                dfd.resolve(true);
                return dfd.promise();
            });
        }

        getItemPath() {
            var arr = [];
            var parent = this.parent;
            
            while (parent) {
                arr.push(parent.name());
                parent = parent.parent;
            }

            return "/" + arr.reverse().join("/") + "/" + this.name();
        }
    }

    export class CompareResult {
        itemPath: string;
        diff: DiffDetail;

        constructor(itemPath: string, diff: DiffDetail) {
            this.itemPath = itemPath;
            this.diff = diff;
        }
    }

    export class Item {
        id: string;
        name: string;
        parentId: string;
        hash: string;
        icon: string;

        constructor(data: ITreeItemDto) {
            this.id = data.Id;
            this.name = data.Name;
            this.parentId = data.ParentId;
            this.hash = data.Hash;
            this.icon = data.Icon;
        }
    }

    class RequestManager {
        private queue: Array<{ op: () => JQueryPromise<any>; promise: JQueryDeferred<any>; }> = [];
        private ongoingCount: number = 0;
        private maxConcurrentRequests: number = 1;

        constructor(maxConcurrentRequests: number) {
            this.maxConcurrentRequests = maxConcurrentRequests;
        }

        add(request: () => JQueryPromise<any>): JQueryPromise<any> {
            var dfd = $.Deferred();
            this.queue.unshift({op: request, promise: dfd });
            this.fireNext();
            return dfd.promise();
        }

        private fireNext() {
            if (this.ongoingCount >= this.maxConcurrentRequests) {
                return;
            }

            console.log("RequestManager.ongoingCount = " + this.ongoingCount);
            var request = this.queue.pop();
            if (request) {
                this.ongoingCount++;
                request.op().then((value: any) => {
                    this.ongoingCount--;
                    this.fireNext();
                    request.promise.resolve(value);
                }, (...args: any[]) => {
                    this.ongoingCount--;
                    this.fireNext();
                    request.promise.reject(args);
                }); 
            }
        }
    }

    interface IDataService {
        db: string;
        setBaseUrl(baseUrl: string);
        getTreeItem(itemId: string): JQueryPromise<ITreeItemDto>;
        getItem(itemId: string): JQueryPromise<IItemWrapperDto>;
        updateItem(item: IItemWrapperDto): JQueryPromise<IItemWrapperDto>;
        deleteItem(itemId: string): JQueryPromise<any>;
    }

    class DataService implements  IDataService {
        private baseUrl: string;
        db: string;

        setBaseUrl(baseUrl: string) {
            baseUrl = baseUrl.replace("http://", "").replace("/sitecore", "");
            if (baseUrl.charAt[baseUrl.length - 1] === "/") {
                baseUrl = baseUrl.substring(baseUrl.length - 1, 1);
            }
            this.baseUrl = "http://" + baseUrl + "/scsyncr/";
        }

        getTreeItem(itemId: string): JQueryPromise<ITreeItemDto> {
            return $.getJSON(this.baseUrl + "get-tree-item", { itemId: itemId, db: this.db });
        }

        getItem(itemId: string): JQueryPromise<IItemWrapperDto> {
            return $.getJSON(this.baseUrl + "get-item", { itemId: itemId, db: this.db });
        }

        updateItem(item: IItemWrapperDto): JQueryPromise<IItemWrapperDto> {
            return $.ajax({
                contentType: "application/json",
                type: "POST",
                url: this.baseUrl + "update-item?db=" + this.db,
                data: JSON.stringify(item)
            });
        }

        deleteItem(itemId: string): JQueryPromise<any> {
            return $.ajax({
                type: "POST",
                url: this.baseUrl + "delete-item?db=" + this.db,
                data: { itemId: itemId }
            });
        }
    }

    class DataServiceMocked implements IDataService {
        db: string;

        setBaseUrl(baseUrl: string) {
            
        }

        getTreeItem(itemId: string): JQueryPromise<ITreeItemDto> {
            var dfd = $.Deferred();

            setTimeout(() => {
                dfd.resolve(mockTreeItem(itemId, true, true));
            }, 1000);

            return dfd.promise();
        }

        getItem(itemId: string): JQueryPromise<IItemWrapperDto> {
            var dfd = $.Deferred();

            setTimeout(() => {
                dfd.resolve(mockItem(itemId));
            }, 1000);

            return dfd.promise();
        }

        updateItem(item: IItemWrapperDto): JQueryPromise<IItemWrapperDto> {
            var dfd = $.Deferred();

            setTimeout(() => {
                dfd.resolve(item);
            }, 1000);

            return dfd.promise();
        }

        deleteItem(itemId: string): JQueryPromise<any> {
            var dfd = $.Deferred();

            setTimeout(() => {
                dfd.resolve({});
            }, 1000);

            return dfd.promise();
        }
    }

    class ServiceLocator {
        viewer: Viewer = new Viewer();
        requestManager: RequestManager = new RequestManager(10);
        srcSvc: IDataService = new DataService();
        tgtSvc: IDataService = new DataService();

        //srcSvc: IDataService = new DataServiceMocked();
        //tgtSvc: IDataService = new DataServiceMocked();

        static current: ServiceLocator = new ServiceLocator();
    }

    export class ViewModel {
        root: KnockoutObservable<Node> = ko.observable<Node>();
        viewer: Viewer = ServiceLocator.current.viewer;
        navigation: Navigation = new Navigation();
        sourceEndpoint: KnockoutObservable<string> = ko.observable<string>();
        targetEndpoint: KnockoutObservable<string> = ko.observable<string>();
    }

    export class Navigation {
        contextualMenu: KnockoutObservable<ContextualMenu> = ko.observable(new ContextualMenu());

        constructor() {
            MessageBus.current.listen("new-contextual-menu", this.newMenu.bind(this));
        }

        newMenu(sender: any, data: any) {
            var menu = <ContextualMenu> data;
            this.contextualMenu(menu);
        }
    }

    export interface ITreeItemDto {
        Id: string;
        ParentId: string;
        Name: string;
        Children: ITreeItemDto[];
        Hash: string;
        Icon: string;
    }

    export interface IItemWrapperDto {
        Item: IItemDto;
        Raw: string;
        Hash: string;
    }

    export interface IItemDto {
        ID: string;
        DatabaseName: string;
        ParentID: string;
        Name: string;
        MasterID: string;
        BranchId: string;
        TemplateID: string;
        TemplateName: string;
    }

    function mockItem(currentId: string): IItemWrapperDto {
        var t = (Math.random() < 0.5 ? "1111" : "0000");
        return { Item: null, Hash: t, Raw: t };
    }

    function mockTreeItem(currentId: string, mustExist: boolean, addChildren: boolean): ITreeItemDto {
        var shouldExist = Math.random() < 0.5,
            hash = Math.random() < 0.5 ? "1234" : "1253";
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

    function parseQuerystring(): any {
        var qs = window.location.search;
        var obj: any = {};
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



    (() => {
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
        var srcPromise = mgr.add(() => sl.srcSvc.getTreeItem("{11111111-1111-1111-1111-111111111111}"));
        var tgtPromise = mgr.add(() => sl.tgtSvc.getTreeItem("{11111111-1111-1111-1111-111111111111}"));

        $.ajaxSettings.cache = false;
        $.when(srcPromise, tgtPromise).done((srcItem: ITreeItemDto, tgtItem: ITreeItemDto) => {
            vm.root(new Node(srcItem, tgtItem, null));
        });
    })();
}