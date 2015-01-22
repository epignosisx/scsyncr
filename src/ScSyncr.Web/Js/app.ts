/// <reference path="../scripts/typings/knockout/knockout.d.ts" />

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
        private source: KnockoutObservable<Item> = ko.observable(null);
        private target: KnockoutObservable<Item> = ko.observable(null);

        show(source: Item, target: Item) {
            this.source(source);
            this.target(target);
        }
    }

    export class ItemComparer {
        compare(source: Item, target: Item) {
            return source.field == target.field;
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
            this.diffDetails = this.getDiffDetails();
            this.diffClass = ko.computed(() => {
                return this.syncExcluded() ? this.diffDetails.className + " diff-icon-disabled" : this.diffDetails.className;
            });
            this.diffTitle = ko.computed(() => {
                return this.syncExcluded() ? "Excluded: " + this.diffDetails.title : this.diffDetails.title; 
            });
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

        loadChildren() {
            var mng = new RequestManager(3);
            mng.add(() => {
                return $.getJSON("", {}).done(this.loadChildrenSuccess.bind(this));
            });
        }

        loadChildrenSuccess(data: Item) {
            
        }

        getDiffDetails(): DiffDetail {
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

        field: string;

        constructor(data: { id: string; name: string }) {
            this.id = data.id;
            this.name = data.name;
        }
    }



    class RequestManager {
        private queue: Array<() => JQueryPromise<any>> = [];
        private ongoingCount: number;
        private maxConcurrentRequests: number;

        constructor(maxConcurrentRequests: number) {
            this.maxConcurrentRequests = maxConcurrentRequests;
        }

        add(request: () => JQueryPromise<any>) {
            this.queue.unshift(request);
            this.fireNext();
        }

        private fireNext() {
            if (this.ongoingCount >= this.maxConcurrentRequests) {
                return;
            }

            var request = this.queue.pop();
            if (request) {
                this.ongoingCount++;
                try {
                    request().always(() => {
                        this.ongoingCount--;
                        this.fireNext();
                    });
                } catch (e) {
                    this.ongoingCount--;
                } 
            }
        }
    }

    class ServiceLocator {
        sourceRequestManager: RequestManager = new RequestManager(2);
        targetRequestManager: RequestManager = new RequestManager(2);

        sourceBaseUrl: string;
        targetBaseUrl: string;
    }

    export class ViewModel {
        root: Node;
        viewer: Viewer = new Viewer();
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

    var serviceLocator = new ServiceLocator();

    (function () {
        var vm = new ViewModel();

        vm.root = populateNode(0, 2, 1, 3);

        ko.applyBindings(vm);
    })();


}