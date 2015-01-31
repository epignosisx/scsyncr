/// <reference path="../scripts/typings/knockout/knockout.d.ts" />

interface JQuery {
    mergely(opts: any): JQuery;
    mergely(method: string, param: any): JQuery;
}

interface KnockoutBindingHandlers {
    diff
}

ko.bindingHandlers.diff = {
    init: (element: HTMLElement, valueAccessor, allBindings, viewModel, bindingContext) => {
        // This will be called when the binding is first applied to an element
        // Set up any initial state, event handlers, etc. here

        var unwrapped = valueAccessor(),
            source = unwrapped.source(),
            target = unwrapped.target();

        $(element).mergely({
            cmsettings: { readOnly: false },
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

module Tree {

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

            //$("#compare").mergely({
            //    cmsettings: { readOnly: false },
            //    lhs: (setValue) => {
            //        setValue(source ? source.Raw : "");
            //    },
            //    rhs: (setValue) => {
            //        setValue(target ? target.Raw : "");
            //    }
            //});
        }
    }

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

        source: Item;
        target: Item;
        children: KnockoutObservableArray<Node> = ko.observableArray([]);
        childrenLoaded: KnockoutObservable<boolean> = ko.observable(false);
        expanded: KnockoutObservable<boolean> = ko.observable(false);
        loadingChildren: KnockoutObservable<boolean> = ko.observable(false);
        expandClass: KnockoutComputed<string>;
        diffClass: KnockoutComputed<string>;
        diffTitle: KnockoutComputed<string>;
        diffDetails: DiffDetail;
        syncExcluded: KnockoutObservable<boolean> = ko.observable(false);
        name: KnockoutComputed<string>;

        constructor(source: ITreeItemDto, target: ITreeItemDto) {
            this.source = source ? new Item(source) : null;
            this.target = target ? new Item(target) : null;

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
                return this.source ? this.source.name : this.target.name;
            });
            this.diffDetails = this.getDiffDetails();
            this.diffClass = ko.computed(() => {
                return this.syncExcluded() ? this.diffDetails.className + " diff-icon-disabled" : this.diffDetails.className;
            });
            this.diffTitle = ko.computed(() => {
                return this.syncExcluded() ? "Excluded: " + this.diffDetails.title : this.diffDetails.title; 
            });
        }

        processChildren(srcChildren: ITreeItemDto[], tgtChildren: ITreeItemDto[]) {
            if (!srcChildren && !tgtChildren) {
                this.childrenLoaded(false);
                return;
            }

            srcChildren = srcChildren || [];
            tgtChildren = tgtChildren || [];

            var srcIdx = 0,
                srcLastMatched = 0,
                tgtIdx = 0,
                tgtLastMatched = 0,
                srcLen = srcChildren.length,
                tgtLen = tgtChildren.length,
                src, tgt;

            
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

        loadChildren() {
            this.loadingChildren(true);
            var mng = ServiceLocator.current.requestManager;
            var srcSvc = ServiceLocator.current.srcSvc;
            var tgtSvc = ServiceLocator.current.tgtSvc;

            if (this.source && this.target) {
                var srcPromise = mng.add(() => srcSvc.getTreeItem(this.source.id));
                var tgtPromise = mng.add(() => tgtSvc.getTreeItem(this.target.id));
                $.when(srcPromise, tgtPromise).done((source: ITreeItemDto, target: ITreeItemDto) => {
                    this.processChildren(source.Children, target.Children);
                }).always(() => {
                    this.loadingChildren(false);
                    this.expanded(true);
                });
            } else if (this.source) {
                mng.add(() => srcSvc.getTreeItem(this.source.id)).done((source) => {
                    this.processChildren(source.Children, null);
                }).always(() => {
                    this.loadingChildren(false);
                    this.expanded(true);
                });;
            } else if (this.target) {
                mng.add(() => tgtSvc.getTreeItem(this.target.id)).done((target) => {
                    this.processChildren(null, target.Children);
                }).always(() => {
                    this.loadingChildren(false);
                    this.expanded(true);
                });;
            }
        }

        getDiffDetails(): DiffDetail {
            if (!this.source) {
                return DiffDetail.remove;
            } else if (!this.target) {
                return DiffDetail.add;
            } else if(this.source.hash == this.target.hash) {
                return DiffDetail.unmodified;
            }
            return DiffDetail.modified;
        }

        showDetails() {
            var menu = new ContextualMenu();

            if (this.diffDetails.type == DiffType.Modified) {
                menu.actions.push(new ContextualMenuAction("Merge", this.merge.bind(this), "octicon octicon-git-merge", "Merge conflicts between source and target."));
            } else if (this.diffDetails.type == DiffType.Add) {
                menu.actions.push(new ContextualMenuAction("Exclude", this.exclude.bind(this), "fa fa-ban", "Prevents source item from being added to target."));
                //menu.actions.push(new ContextualMenuAction("Undo Exclude", this.ignore.bind(this), "fa fa-undo", "Prevents source item from being added to target."));
            } else if (this.diffDetails.type == DiffType.Remove) {
                menu.actions.push(new ContextualMenuAction("Keep Target", this.keepTarget.bind(this), "octicon octicon-bookmark", "Prevents target item from being removed."));
                menu.actions.push(new ContextualMenuAction("Keep Target & Children", this.removeTarget.bind(this), "octicon octicon-bookmark", "Prevents target item and its children from being removed"));
                //menu.actions.push(new ContextualMenuAction("Undo Keep Target", this.removeTarget.bind(this), "fa fa-undo", "Undo: Prevents target item from being removed."));
                //menu.actions.push(new ContextualMenuAction("Undo Keep Target & Children", this.removeTarget.bind(this), "fa fa-undo", "Undo: Prevents target item and its children from being removed"));
            } else if (this.diffDetails.type == DiffType.Unmodified) {

            }

            if (this.diffDetails.type == DiffType.Add || this.diffDetails.type == DiffType.Remove) {
                menu.actions.push(new ContextualMenuAction("Sync", this.sync.bind(this), "octicon octicon-git-pull-request", "Commit changes to item to target."));
                menu.actions.push(new ContextualMenuAction("Sync With Children", this.syncWithChildren.bind(this), "octicon octicon-git-pull-request", "Commit changes to item and children to target."));
            }

            MessageBus.current.send("new-contextual-menu", this, menu);


            var mng = ServiceLocator.current.requestManager,
                srcSvc = ServiceLocator.current.srcSvc,
                tgtSvc = ServiceLocator.current.tgtSvc,
                srcPromise,
                tgtPromise;

            if (this.source && this.target) {
                srcPromise = mng.add(() => srcSvc.getItem(this.source.id));
                tgtPromise = mng.add(() => tgtSvc.getItem(this.target.id));

                $.when(srcPromise, tgtPromise).done((source: IItemWrapperDto, target: IItemWrapperDto) => {
                    ServiceLocator.current.viewer.show(source, target);
                });
            }else if (this.source) {
                srcPromise = mng.add(() => srcSvc.getItem(this.source.id));
                srcPromise.done((source: IItemWrapperDto) => {
                    ServiceLocator.current.viewer.show(source, null);
                });
            }else if (this.target) {
                tgtPromise = mng.add(() => tgtSvc.getItem(this.target.id));
                tgtPromise.done((target: IItemWrapperDto) => {
                    ServiceLocator.current.viewer.show(null, target);
                });
            }
        }

        exclude() {
            this.syncExcluded(true);
        }

        merge() {
        }

        removeTarget() {
        }

        keepTarget() {
        }

        sync() {
        }

        syncWithChildren() {
        }
    }

    export class Item {
        id: string;
        name: string;
        parentId: string;
        hash: string;

        constructor(data: ITreeItemDto) {
            this.id = data.Id;
            this.name = data.Name;
            this.parentId = data.ParentId;
            this.hash = data.Hash;
        }
    }

    class RequestManager {
        private queue: Array<{ op: () => JQueryPromise<any>; promise: JQueryDeferred<any>; }> = [];
        private ongoingCount: number;
        private maxConcurrentRequests: number;

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
        getItem(itemId: string): JQueryPromise<any>;
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
    }

    class ServiceLocator {
        viewer: Viewer = new Viewer();
        requestManager: RequestManager = new RequestManager(2);
        //srcSvc: IDataService = new DataService();
        //tgtSvc: IDataService = new DataService();

        srcSvc: IDataService = new DataServiceMocked();
        tgtSvc: IDataService = new DataServiceMocked();

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

        $.when(srcPromise, tgtPromise).done((srcItem: ITreeItemDto, tgtItem: ITreeItemDto) => {
            vm.root(new Node(srcItem, tgtItem));
        });
    })();
}